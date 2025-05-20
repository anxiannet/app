
import * as admin from 'firebase-admin';

// Check if GOOGLE_APPLICATION_CREDENTIALS is set in the environment,
// especially relevant for local development or non-Firebase hosted server environments.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !admin.apps.length && process.env.NODE_ENV === 'development') {
  console.warn(
    "Firebase Admin SDK Warning: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. " +
    "For local development, this is required. If deploying to Firebase/Google Cloud, " +
    "this is usually handled by Application Default Credentials."
  );
}

if (!admin.apps.length) {
  try {
    console.log("Attempting to initialize Firebase Admin SDK...");
    admin.initializeApp({
      // When deployed to Firebase (e.g., Cloud Functions, App Hosting),
      // the SDK automatically discovers credentials if the service account has appropriate permissions.
      // For local development, you MUST set the GOOGLE_APPLICATION_CREDENTIALS
      // environment variable to the path of your service account key JSON file.
      // credential: admin.credential.applicationDefault(), // This line is often not needed if GOOGLE_APPLICATION_CREDENTIALS is set.
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error('CRITICAL Firebase Admin SDK initialization error:', error);
    // Throwing the error here might stop the server, which could be desired
    // to make the configuration issue immediately obvious.
    // Or, handle it in a way that dependent services know initialization failed.
    // For now, we'll log and let other parts of the app potentially fail if they depend on 'db'.
  }
}

let db: admin.firestore.Firestore;
let authAdmin: admin.auth.Auth;

try {
  db = admin.firestore();
  authAdmin = admin.auth();
} catch (error) {
  console.error("Failed to get Firestore or Auth instance from Firebase Admin. Was initializeApp successful?", error);
  // Provide dummy instances or throw to prevent further errors
  // This is a fallback, ideally initializeApp should succeed.
  // @ts-ignore
  db = null; 
  // @ts-ignore
  authAdmin = null;
}


export { db, authAdmin, admin };
