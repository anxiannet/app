
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== "undefined") { // Only run on client
  if (!getApps().length) {
    // Pre-initialization checks
    if (!firebaseConfig.apiKey) {
      console.error(
        "Firebase Initialization Error: NEXT_PUBLIC_FIREBASE_API_KEY is missing or undefined. " +
        "Please ensure it is correctly set in your .env.local file and that your Next.js development server has been restarted after changes to .env.local."
      );
    } else if (firebaseConfig.apiKey.includes("AIza") && firebaseConfig.apiKey.length < 20) { // Basic check for common placeholder prefixes or very short keys
      // Note: Real API keys start with "AIza" but are much longer. This is a loose check.
      console.warn(
        "Firebase Initialization Warning: The provided NEXT_PUBLIC_FIREBASE_API_KEY might be a placeholder or unexpectedly short. " +
        `It starts with "${firebaseConfig.apiKey.substring(0, 4)}". Please verify it's the correct API key for project ID "${firebaseConfig.projectId || 'PROJECT_ID_MISSING'}" in your .env.local file.`
      );
    }

    // Attempt initialization
    try {
      console.log(`Attempting to initialize Firebase for project ID: ${firebaseConfig.projectId || 'PROJECT_ID_MISSING'}`);
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      console.log(`Firebase initialized successfully for project ID: ${firebaseConfig.projectId || 'Not specified'}`);
    } catch (error) {
      console.error("Firebase client initialization error during initializeApp/getAuth/getFirestore:", error);
      // Log details about the config that caused the error, but mask sensitive parts if necessary
      console.error("Firebase config that may have caused the error (check environment variables):", {
        apiKey_isDefined: !!firebaseConfig.apiKey,
        authDomain_isDefined: !!firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId || "PROJECT_ID_MISSING_IN_CONFIG",
      });
    }
  } else { // Already initialized
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

export { app, auth, db };
