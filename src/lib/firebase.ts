
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
// For Firestore, we use initializeFirestore to allow custom host, or getFirestore for default.
import { getFirestore, type Firestore } from "firebase/firestore"; // Standard import

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

// Authentication Proxy (User-intended, but not directly configurable in SDK for all API calls)
const AUTH_PROXY_HOST = "auth-jolly-bread-8cd4.bostage.workers.dev";


if (typeof window !== "undefined") {
  console.log("Firebase Config about to be used by client (CHECK apiKey and projectId HERE):", JSON.stringify({
    apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0,5) + "..." : "MISSING_OR_UNDEFINED_API_KEY",
    authDomain: firebaseConfig.authDomain || "MISSING_OR_UNDEFINED_AUTH_DOMAIN",
    projectId: firebaseConfig.projectId || "PROJECT_ID_MISSING_IN_CONFIG_OBJECT",
    storageBucket: firebaseConfig.storageBucket || "MISSING_OR_UNDEFINED_STORAGE_BUCKET",
    messagingSenderId: firebaseConfig.messagingSenderId || "MISSING_OR_UNDEFINED_MESSAGING_SENDER_ID",
    appId: firebaseConfig.appId || "MISSING_OR_UNDEFINED_APP_ID",
  }, null, 2));

  let criticalConfigMissing = false;
  if (!firebaseConfig.apiKey) {
    console.error(
      "CRITICAL Firebase Initialization Error: NEXT_PUBLIC_FIREBASE_API_KEY is MISSING or UNDEFINED in the configuration object. \n" +
      "ACTION REQUIRED: \n" +
      "1. For LOCAL DEVELOPMENT: Ensure it is correctly set in your .env.local file (in the project root) AND that your Next.js development server has been RESTARTED after any changes to .env.local. \n" +
      "2. For DEPLOYMENT: Ensure this NEXT_PUBLIC_FIREBASE_API_KEY environment variable is correctly set in your Firebase Hosting build environment / CI/CD settings."
    );
    criticalConfigMissing = true;
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
        
        auth = getAuth(app);
        console.log("Firebase Auth initialized to use default Google endpoints.");
        console.warn(
          `Firebase Auth Proxying: User intends to use proxy at ${AUTH_PROXY_HOST} for Authentication API calls. ` +
          "However, the Firebase JS SDK for Authentication does NOT provide a simple configuration option " +
          "to route all its core API calls (to identitytoolkit.googleapis.com and securetoken.googleapis.com) " +
          "through a custom host proxy in this manner. Authentication requests will continue to go directly to Google's servers. " +
          "Advanced proxying for Auth usually requires backend-mediated calls or network-level solutions."
        );

        // Initialize Firestore using default Google endpoints
        console.log("Attempting to initialize Firestore with default Google endpoints.");
        db = getFirestore(app); // Reverted to standard initialization
        console.log(`Firestore configured to use default Google endpoints.`);
        
        console.warn("Firebase Storage is NOT configured to use any proxy with the current client SDK setup. It will use default Google endpoints.");
        console.log(`Firebase initialized successfully for project ID: ${firebaseConfig.projectId}.`);

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
    } else { 
      app = getApps()[0];
      auth = getAuth(app); // Auth will still use default endpoints
      
      // Standard Firestore initialization if app already exists
      if (!db) { // Check if db is already initialized
        console.log("Re-initializing Firestore on existing app instance with default Google endpoints.");
        db = getFirestore(app);
        console.log(`Firestore re-configured to use default Google endpoints.`);
      } else {
        console.log("Firestore already initialized with default Google endpoints.");
      }
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
  }
}

export { app, auth, db };
