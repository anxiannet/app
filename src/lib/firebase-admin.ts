
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // When deployed to Firebase (e.g., Cloud Functions, App Engine),
      // the SDK automatically discovers credentials.
      // For local development, you'd set the GOOGLE_APPLICATION_CREDENTIALS
      // environment variable to the path of your service account key JSON file.
      // credential: admin.credential.applicationDefault(), // Or specify if needed
      // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com` // If using Realtime Database
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const db = admin.firestore();
const authAdmin = admin.auth();

export { db, authAdmin, admin };
