// Correct imports for Firebase Functions v2 and logger
const { onRequest } = require("firebase-functions/v2/https");
const functions = require('firebase-functions');
const { logger } = require("firebase-functions/logger");
const admin = require('firebase-admin');
admin.initializeApp();


// Example HTTP function
exports.helloWorld = onRequest((request, response) => {
    functions.logger.info("Hello logs!", { structuredData: true });
    response.send("Hello from Firebase!");
});

// Example Auth trigger function
exports.createNewUser = functions.auth.user().onCreate((user) => {
    functions.logger.log(`Creating new user with ${user.email}`);

    const userData = {
        email: user.email, // The email of the user.
        name: user.displayName || 'Anonymous', // The display name of the user, or 'Anonymous' if not set.
        uid: user.uid // The unique identifier for the user.
    };

    // Add the user document to the "users" collection with the UID as the document ID
    return admin.firestore().collection('users').doc(user.uid).set(userData)
        .then(() => {
            functions.logger.log(`Successfully created new user document for UID: ${user.uid}`);
        })
        .catch((error) => {
            functions.logger.error(`Error creating new user document for UID: ${user.uid}`, error);
        });

});
