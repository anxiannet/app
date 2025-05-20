
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";

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

// Firestore Proxy Configuration
const FIRESTORE_PROXY_HOST = "black-rain-7f1e.bostage.workers.dev"; // Your Cloudflare Worker for Firestore
// Authentication Proxy (Note: Client SDK has limited direct support for this type of proxying)
// const AUTH_PROXY_HOST = "auth-jolly-bread-8cd4.bostage.workers.dev"; // Your Cloudflare Worker for Auth

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
        
        // Initialize Auth (will use default Google endpoints)
        auth = getAuth(app);
        console.log("Firebase Auth initialized to use default Google endpoints.");
        console.warn(
          "Firebase Auth Proxying: The Firebase JS SDK for Authentication does not have a straightforward client-side configuration to route all API calls " +
          `through a path-based proxy like 'https://${"auth-jolly-bread-8cd4.bostage.workers.dev"}/auth/...'. ` +
          "Authentication requests will go directly to Google's identitytoolkit.googleapis.com."
        );

        // Initialize Firestore with proxy
        // The host should be the domain of your worker. The SDK will append /v1/projects/...
        // Your worker script expects "/firestore" as the first path segment.
        // So, the host setting needs to include "/firestore" for your worker to route correctly.
        const firestoreHostWithServicePath = `${FIRESTORE_PROXY_HOST}/firestore`;
        console.log(`Attempting to initialize Firestore with proxy host: ${firestoreHostWithServicePath}`);
        db = initializeFirestore(app, {
          host: firestoreHostWithServicePath, 
          ssl: true,        // Assuming your worker is served over HTTPS
          ignoreUndefinedProperties: true,
        });
        console.log(`Firestore configured to use proxy host: ${firestoreHostWithServicePath}. The Firebase SDK will append paths like /v1/projects/... after this.`);
        
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
      auth = getAuth(app); 
      
      // Ensure Firestore is initialized with proxy settings if app was already initialized
      // Check if db is already initialized and if its settings match the desired proxy
      const currentDbHost = db && (db.settings as any)?.host;
      const targetFirestoreHost = `${FIRESTORE_PROXY_HOST}/firestore`;

      if (!db || currentDbHost !== targetFirestoreHost) {
        console.log(`Re-initializing Firestore on existing app instance with proxy host: ${targetFirestoreHost}`);
        db = initializeFirestore(app, {
          host: targetFirestoreHost,
          ssl: true,
          ignoreUndefinedProperties: true,
        });
        console.log(`Firestore re-configured to use proxy host: ${targetFirestoreHost}.`);
      } else {
        console.log("Firestore already initialized with proxy settings. Current host:", currentDbHost);
      }
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
  }
}

export { app, auth, db };

    