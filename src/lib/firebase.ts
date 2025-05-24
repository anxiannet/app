
"use client";

// This file originally contained Firebase client SDK initialization.
// As per the request to remove Firebase for core game data and authentication,
// active initializations for Firestore and Auth have been removed.
// The application now relies on localStorage for room data and a mock login system.

// The Firebase config object itself is derived from environment variables.
// It's left here as it's inert if not used by initializeApp().
// If you were to re-introduce Firebase services on the client-side,
// you would uncomment and use the initializeApp logic.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
// import { getFirestore, type Firestore } from "firebase/firestore";
// No client-side Firebase Auth is being used due to mock login.

let appInitialized = false;

if (typeof window !== "undefined") {
  // Basic check to ensure environment variables are present, as per previous setup.
  // This does not initialize Firebase anymore.
  let criticalConfigMissing = false;
  if (!firebaseConfig.apiKey) {
    console.error(
      "CRITICAL Firebase Client SDK Configuration Alert: NEXT_PUBLIC_FIREBASE_API_KEY is MISSING or UNDEFINED. " +
      "While Firebase client services (Firestore/Auth for game) are not actively initialized in this version, this variable would be needed if they were. " +
      "Ensure it is set for any potential future use or for other Firebase services like Storage if used."
    );
    criticalConfigMissing = true;
  }
  if (!firebaseConfig.projectId) {
    console.error(
      "CRITICAL Firebase Client SDK Configuration Alert: NEXT_PUBLIC_FIREBASE_PROJECT_ID is MISSING or UNDEFINED. " +
      "While Firebase client services (Firestore/Auth for game) are not actively initialized in this version, this variable would be needed if they were. " +
      "Ensure it is set for any potential future use or for other Firebase services like Storage if used."
    );
    criticalConfigMissing = true;
  }

  if (!criticalConfigMissing) {
    // console.log("Firebase config appears present, but Firebase App is NOT being initialized for core game features (Auth/Firestore).");
    // Example: If you were to initialize app for OTHER services (e.g., Storage)
    // if (!getApps().length) {
    //   try {
    //     const app = initializeApp(firebaseConfig);
    //     appInitialized = true;
    //     // db = getFirestore(app); // Firestore not used for rooms
    //     // auth = getAuth(app); // Auth not used for login
    //   } catch (error) {
    //     console.error("Firebase app initialization error (if it were attempted):", error);
    //   }
    // } else {
    //   appInitialized = true;
    // }
  } else {
    console.warn("Firebase app initialization SKIPPED due to missing critical configuration.");
  }
}

// No exports like app, db, auth as they are not being set up for client game use.
// If you need to use other Firebase services (e.g., Storage) on the client,
// you would initialize 'app' and export it.

console.warn(
  "Firebase client-side services (Firestore for room data, Firebase Auth for login) are NOT in use. " +
  "The application uses localStorage for room data and a mock login system."
);

// Note: Server-side Firebase Admin SDK (in /src/lib/firebase-admin.ts) is still
// present for potential admin functionalities (like /api/admin/set-admin-status).
// If "completely no firebase code" implies removing that as well, further changes
// to those server-side files would be needed.

    