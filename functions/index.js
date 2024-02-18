const { onRequest, onCall } = require("firebase-functions/v2/https");
const functions = require('firebase-functions');
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { user } = require("firebase-functions/v1/auth");
const { DateTime } = require('luxon');

admin.initializeApp();

// Example HTTP function
exports.helloWorld = onRequest((request, response) => {
    logger.info("Hello logs!", { structuredData: true });
    response.send("Hello from Firebase!");
});

// Example Auth trigger function
exports.createNewUser = functions.auth.user().onCreate((user) => {
    logger.log(`Creating new user with ${user.email}`);

    // Get current time for quitDate
    const almatyMidnight = DateTime.now().setZone('Asia/Almaty').startOf('day');
    const timestamp = almatyMidnight.toJSDate();

    const userData = {
        email: user.email, // The email of the user.
        name: user.displayName || 'Anonymous', // The display name of the user, or 'Anonymous' if not set.
        uid: user.uid, // The unique identifier for the user.
        photoUrl: user.photoURL,
        dailyCigaretteLimit: 0,
        moneySaved: 0,
        quitDate: timestamp, // Store quitDate as Firestore Timestamp
        friends: [],
        invitations: [],
        achievements: ["First Step"],
        streak: 0
    };

    // Add the user document to the "users" collection with the UID as the document ID
    admin.firestore().collection('users').doc(user.uid).set(userData)
        .then(() => {
            logger.log(`Successfully created new user document for UID: ${user.uid}`);
        })
        .catch((error) => {
            logger.error(`Error creating new user document for UID: ${user.uid}`, error);
        });

    const userRef = admin.firestore().collection('users').doc(user.uid);

    const firstDayData = {
        cigarettesSmoked: 0,
        date: timestamp, // Store current date as Firestore Timestampnew
        uid: userRef, // Directly storing UID as string for simplicity
    }

    const dateStr = almatyMidnight.toISODate();
    // Assuming you want to track each user's smoke-free days in a subcollection under their user document
    admin.firestore().collection('users').doc(user.uid).collection('smokeFreeDays').doc(dateStr).set(firstDayData)
        .then(() => {
            logger.log(`Successfully created first day of smokeFreeDays for UID: ${user.uid}`);
        })
        .catch((error) => {
            logger.error(`Error creating first day of smokeFreeDays for UID: ${user.uid}`, error);
        });
});

exports.dailyStreakAndEntryUpdate = functions.pubsub.schedule('*/5 * * * *')
    .timeZone('Asia/Almaty')
    .onRun(async (context) => {
        const usersSnapshot = await admin.firestore().collection('users').get();

        if (usersSnapshot.empty) {
            logger.log('No users found for daily streak and entry update.');
            return;
        }

        // Create a date in the 'Asia/Almaty' time zone for "yesterday"
        const yesterdayString = DateTime.now().setZone('Asia/Almaty').startOf('day').minus({ days: 1 }).toISODate();

        // Create a date in the 'Asia/Almaty' time zone for "today"
        const todayString = DateTime.now().setZone('Asia/Almaty').startOf('day').toISODate();

        const updates = [];

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;

            try {
                const todayDoc = await admin.firestore().collection('users').doc(userId).collection('smokeFreeDays').doc(todayString).get();

                if (!todayDoc.exists) {
                    updates.push(admin.firestore().collection('users').doc(userId).collection('smokeFreeDays').doc(todayString).set({
                        cigarettesSmoked: 0,
                        date: todayString,
                    }));
                } else {
                    logger.log(`Entry for today (${todayString}) already exists for user ${userId}. Skipping.`);
                    continue;
                }

                const yesterdayDoc = await admin.firestore().collection('users').doc(userId).collection('smokeFreeDays').doc(yesterdayString).get();

                if (yesterdayDoc.exists && yesterdayDoc.data().cigarettesSmoked === 0) {
                    updates.push(admin.firestore().collection('users').doc(userId).update({
                        streak: admin.firestore.FieldValue.increment(1)
                    }));
                } else {
                    updates.push(admin.firestore().collection('users').doc(userId).update({
                        streak: 0
                    }));
                }
            } catch (error) {
                logger.error(`Error processing user ${userId}:`, error);
            }
        }

        await Promise.all(updates);
        logger.log('Daily streak and entry updates completed successfully.');
    });

exports.inviteFriend = onCall(async (request) => {
    const friendId = request.data.friendId;
    const uid = request.auth.uid;
    // const uid = "F3aWrzz4z2fNlIp3Hw3kz3viN1wW"

    if (!friendId || friendId.trim() === "") {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a non-empty "friendId".');
    }

    // Check if uid is available and not an empty string
    if (!uid || uid.trim() === "") {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated with a non-empty UID.');
    }

    try {
        const userSnapshot = await admin.firestore().collection("users").doc(uid).get()
        if (!userSnapshot.exists) {
            logger.error('No user found with UID:', uid);
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const userData = userSnapshot.data();

        const friendSnapshot = await admin.firestore().collection("users").doc(friendId).get();
        if (!friendSnapshot.exists) {
            logger.error('No friend found with UID:', uid);
            throw new functions.https.HttpsError('not-found', 'Friend user not found.');
        }

        const friendData = friendSnapshot.data();

        // add check if friend that is invited is already a friend
        if (friendData.friends.includes(uid)) {
            logger.log('The user is already a friend.');
            return { success: false, message: 'This user is already a friend.' };
        }

        await admin.firestore().collection("users").doc(friendId).update({
            invitations: FieldValue.arrayUnion(uid)
        });


        if (friendData && friendData.fcmToken) {
            const userName = userData.name || 'Someone';
            const message = {
                notification: {
                    title: 'You have a new invitation!',
                    body: `${userName} has invited you to connect.`
                },
                token: friendData.fcmToken
            };

            await admin.messaging().send(message);
        }

        return { success: true, message: 'Invitation sent and notification delivered.' };
    } catch (error) {
        logger.error("Error sending invitation: ", error);
        throw new functions.https.HttpsError('unknown', 'Failed to send invitation.', error);
    }
});

exports.handleInvitation = onCall(async (request) => {
    const friendId = request.data.friendId;
    const uid = request.auth.uid;
    // const uid = "ycLTl1pRYPrXaJ0EjXjPrInHmqba"
    const accept = request.data.accept

    // Check if friendId is provided, not null, and not an empty string
    if (!friendId || friendId.trim() === "") {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a non-empty "friendId".');
    }

    // Check if uid is available and not an empty string
    if (!uid || uid.trim() === "") {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated with a non-empty UID.');
    }

    // Reference to the user's document and the friend's document
    const userRef = admin.firestore().collection("users").doc(uid);
    const friendRef = admin.firestore().collection("users").doc(friendId);

    try {
        await admin.firestore().runTransaction(async (transaction) => {
            // Transactional read of user and friend documents
            const userDoc = await transaction.get(userRef);
            const friendDoc = await transaction.get(friendRef);

            if (!userDoc.exists || !friendDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'User or friend not found.');
            }

            let userData = userDoc.data();
            let friendData = friendDoc.data();

            // Remove friendId from the user's invitations
            if (userData.invitations.includes(friendId)) {
                transaction.update(userRef, {
                    invitations: FieldValue.arrayRemove(friendId)
                });
            }

            if (accept) {
                // Add friendId to the user's friends
                transaction.update(userRef, {
                    friends: FieldValue.arrayUnion(friendRef)
                });

                // Add uid to the friend's friends
                transaction.update(friendRef, {
                    friends: FieldValue.arrayUnion(userRef)
                });

                // Optionally, send a notification to the friend
                if (friendData.fcmToken) {
                    const message = {
                        notification: {
                            title: 'Friend request accepted',
                            body: `${userData.name || 'A user'} has accepted your friend request.`
                        },
                        token: friendData.fcmToken
                    };

                    await admin.messaging().send(message);
                }
            }
        });

        return { success: true, message: accept ? 'Friend request accepted.' : 'Friend request rejected.' };
    } catch (error) {
        logger.error('Error handling invitation:', error);
        throw new functions.https.HttpsError('internal', 'Error handling invitation.', error);
    }
});


exports.dashboard = onCall(async (request) => {
    const uid = request.auth.uid;
    // const uid = "1eXKKjiCqcuf9w77RrM7RT9MSCIq";
    const type = request.data.type || "year"; // Default to "year" if not specified

    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    // Calculate start date based on the type (year, month, week)
    const almatyMidnight = DateTime.now().setZone('Asia/Almaty').startOf('day');
    const startDate = almatyMidnight.toJSDate();
    switch (type) {
        case "year":
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        case "month":
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case "week":
            startDate.setDate(startDate.getDate() - 7);
            break;
        default:
            // Default to "year" if an unknown type is provided
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
    }
    startDate.setHours(0, 0, 0, 0); // Set time to the start of the day

    // Firestore range query
    const smokeFreeDaysRef = admin.firestore().collection("users").doc(uid).collection("smokeFreeDays");
    const smokeFreeDaysSnapshot = await smokeFreeDaysRef
        .where("date", ">=", startDate)
        .get();

    let totalSmokedCigarettes = 0;
    let totalSmokeFreeDays = 0;
    let moneySaved = 0;
    const pricePerPack = 500; // Assuming 500 tenge per pack
    const cigarettesPerPack = 20;

    smokeFreeDaysSnapshot.docs.forEach(doc => {
        const { cigarettesSmoked } = doc.data();
        totalSmokedCigarettes += cigarettesSmoked;
        if (cigarettesSmoked === 0) {
            totalSmokeFreeDays += 1;
        }
        // Assuming the user saves money for each cigarette not smoked
        moneySaved += (cigarettesPerPack - cigarettesSmoked) * (pricePerPack / cigarettesPerPack);
    });

    // Assuming userData contains streak and achievements
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const userData = userDoc.data() || {};

    return {
        totalSmokedCigarettes,
        totalSmokeFreeDays,
        moneySaved: `${moneySaved.toFixed(2)} ₸`,
        streak: userData.streak || 0,
        achievements: userData.achievements || []
    };
});