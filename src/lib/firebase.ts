
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore"; // Changed from getFirestore

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | undefined = undefined;
let auth: Auth | undefined = undefined;
let db: Firestore | undefined = undefined;

const PROXY_HOST = "black-rain-7f1e.bostage.workers.dev";

if (typeof window !== "undefined") { // Only run on client
  // Log the configuration object that will be used
  console.log("Firebase Config about to be used by client (CHECK apiKey and projectId HERE):", JSON.stringify(firebaseConfig, null, 2));

  let criticalConfigMissing = false;
  if (!firebaseConfig.apiKey) {
    console.error(
      "CRITICAL Firebase Initialization Error: NEXT_PUBLIC_FIREBASE_API_KEY is MISSING or UNDEFINED in the configuration object. \n" +
      "ACTION REQUIRED: \n" +
      "1. For LOCAL DEVELOPMENT: Ensure it is correctly set in your .env.local file (in the project root) AND that your Next.js development server has been RESTARTED after any changes to .env.local. \n" +
      "2. For DEPLOYMENT: Ensure this NEXT_PUBLIC_FIREBASE_API_KEY environment variable is correctly set in your Firebase Hosting build environment / CI/CD settings."
    );
    criticalConfigMissing = true;
  } else if (firebaseConfig.apiKey.includes("AIza") && firebaseConfig.apiKey.length < 20) {
    console.warn(
      "Firebase Initialization Warning: The provided NEXT_PUBLIC_FIREBASE_API_KEY might be a placeholder or unexpectedly short. " +
      `It starts with "${firebaseConfig.apiKey.substring(0, 4)}". Please verify it's the correct API key for project ID "${firebaseConfig.projectId || 'PROJECT_ID_MISSING'}" in your .env.local file (for local dev) or deployment environment variables.`
    );
  }

  if (!firebaseConfig.projectId) {
    console.error(
      "CRITICAL Firebase Initialization Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is MISSING or UNDEFINED in the configuration object. \n" +
      "ACTION REQUIRED: \n" +
      "1. For LOCAL DEVELOPMENT: Ensure it is correctly set in your .env.local file (in the project root) AND that your Next.js development server has been RESTARTED after any changes to .env.local. \n" +
      "2. For DEPLOYMENT: Ensure this NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is correctly set in your Firebase Hosting build environment / CI/CD settings."
    );
    criticalConfigMissing = true;
  }

  if (!criticalConfigMissing) {
    if (!getApps().length) {
      try {
        console.log(`Attempting to initialize Firebase for project ID: ${firebaseConfig.projectId}`);
        app = initializeApp(firebaseConfig);
        auth = getAuth(app); // Auth will use default endpoints

        // Configure Firestore to use the proxy
        // The worker expects the service name as the first path segment.
        // The SDK will make requests like: https://PROXY_HOST/firestore/v1/projects/...
        const firestoreHostWithServicePath = `${PROXY_HOST}/firestore`;
        console.log(`Initializing Firestore with proxy host: ${firestoreHostWithServicePath}`);
        db = initializeFirestore(app, {
          host: firestoreHostWithServicePath,
          ssl: true, // Assuming your worker is served over HTTPS
          ignoreUndefinedProperties: true, // Good practice
        });
        
        console.log(`Firebase initialized successfully for project ID: ${firebaseConfig.projectId}. Firestore is configured to use proxy: ${firestoreHostWithServicePath}.`);
        console.warn("Firebase Auth and Storage are NOT configured to use this proxy with the current client SDK setup. They will use default Google endpoints.");

      } catch (error) {
        console.error("Firebase client initialization error during initializeApp/getAuth/getFirestore:", error);
        console.error("Firebase config that may have caused the error (check environment variables):", {
          apiKey_isDefined: !!firebaseConfig.apiKey,
          apiKey_value_snippet: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 5) + "..." : "UNDEFINED",
          authDomain_isDefined: !!firebaseConfig.authDomain,
          projectId_isDefined: !!firebaseConfig.projectId,
          projectId_value: firebaseConfig.projectId || "PROJECT_ID_MISSING_IN_CONFIG_OBJECT",
        });
      }
    } else { // Already initialized
      app = getApps()[0];
      auth = getAuth(app); // Auth will use default endpoints
      
      // Check if db is already initialized with proxy settings, otherwise re-initialize with proxy
      // This scenario is less common for client-side but good for robustness
      const existingDb = db; // Check if 'db' was somehow set globally before this point
      if (!existingDb || (existingDb && !(existingDb.settings && (existingDb.settings as any).host?.includes(PROXY_HOST)))) {
        const firestoreHostWithServicePath = `${PROXY_HOST}/firestore`;
        console.log(`Re-initializing Firestore on existing app instance with proxy host: ${firestoreHostWithServicePath}`);
        db = initializeFirestore(app, {
          host: firestoreHostWithServicePath,
          ssl: true,
          ignoreUndefinedProperties: true,
        });
      } else {
        console.log("Firestore already initialized, possibly with proxy settings.");
      }
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
  }
}

export { app, auth, db };
