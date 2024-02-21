# Respire

## Overview

Respire is a cutting-edge application designed to support individuals in their journey to quit smoking by fostering a collaborative and supportive environment. Recognizing that quitting smoking is a challenging endeavor that benefits greatly from encouragement and accountability, Respire leverages the power of community and technology to create a unique support system for its users. The core of Respire's functionality is facilitated through a series of backend services, implemented as Cloud Functions on Firebase, providing a seamless, real-time experience for users across the globe.

## Key Features
Respire offers a range of features aimed at making the smoking cessation process as effective and engaging as possible. These include personalized dashboards, daily streak tracking, friend systems with invitations and challenges, and notifications for achievements and reminders. By focusing on collaboration, Respire encourages users to connect with friends, share progress, and support each other, making the journey towards a smoke-free life less isolating.

## Technologies Used
### Firebase Firestore
At the heart of Respire's data management is Firebase Firestore, a NoSQL cloud database that stores and synchronizes user data in real-time. Firestore's scalable and flexible structure allows for efficient storage of user profiles, smoke-free streaks, friend lists, and other dynamic data, enabling quick updates and retrieval to ensure a responsive user experience.

### Cloud Functions
Respire's backend logic is powered by Cloud Functions for Firebase, a serverless framework that allows for the execution of backend code in response to events triggered by Firebase features and HTTPS requests. These functions encompass a variety of tasks, including user account management upon authentication events, scheduled tasks for daily updates, and callable functions for specific features like friend invitations and dashboard statistics. This serverless approach ensures scalability, reliability, and seamless integration with other Firebase services.

### Authentication
Security and user identity are managed through Firebase Authentication, providing a robust and secure authentication system that supports various sign-in methods, including email/password, social media accounts, and more. This service seamlessly integrates with Firestore and Cloud Functions, enabling personalized user experiences and secure access to user data.

### Cloud Messaging
In addition to Firestore, Cloud Functions, and Authentication, Respire utilizes Firebase Cloud Messaging (FCM) to enhance user engagement and retention through timely and relevant notifications. FCM is a powerful, cost-free cloud solution that enables the delivery of messages and notifications directly to users' devices across platforms (iOS, Android, and web). This feature plays a crucial role in Respire's ability to keep users informed and motivated throughout their quit-smoking journey.

## Setup
1. Install Firebase CLI: Ensure you have the Firebase CLI installed and logged in to your Firebase account. If not, you can install it with npm:
```bash
npm install -g firebase-tools
```
2. Clone the Repository: Clone this repository or download the Cloud Functions code to your local machine.

3. Install Dependencies: Navigate to the functions directory and install the necessary dependencies:

```bash
cd path/to/your/functions
npm install
```
4. Firebase Project Setup: Make sure you have a Firebase project created and initialized in your working directory:
```bash
firebase init
```
Select the 'Functions' option and follow the prompts to link your local directory with your Firebase project.

5. Environment Configuration: Some functions may require additional configuration (e.g., API keys, external service configs). Set these up using Firebase environment config if needed:
```bash
firebase functions:config:set someservice.key="THE_API_KEY"
```
## Deployment
Deploy your functions to Firebase using the CLI:

```bash
firebase deploy --only functions
```
This command deploys all your functions to Firebase. If you wish to deploy individual functions, use:

```bash
firebase deploy --only functions:functionName
```
## Function Details
`createNewUser`
* Trigger: Firebase Authentication onCreate event
* Purpose: Initializes a new user's profile in Firestore with default settings and the current date as their quit date.

`dailyStreakAndEntryUpdate`
* Trigger: Scheduled (every 5 minutes, customizable)
* Purpose: Updates the smoke-free streak for each user and adds a new entry for tracking daily smoke-free status.

`inviteFriend`
* Trigger: Callable
* Purpose: Allows a user to send a friend invitation to another user by updating Firestore documents.

`handleInvitation`
* Trigger: Callable
* Purpose: Allows users to accept or reject friend invitations, updating their friend list accordingly.

`dashboard`
* Trigger: Callable
* Purpose: Aggregates and returns data for a user's dashboard, including total cigarettes smoked, smoke-free days, and money saved.

`friendsQuest`
* Trigger: Callable
* Purpose: Aggregates data on a user and their friends' smoking cessation progress over the past week.


## Mobile (Client) side
* Here's the mobile application: https://github.com/aidanakalimbekova/respire-mobile
