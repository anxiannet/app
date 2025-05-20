
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore"; // Added getFirestore for direct init

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
        auth = getAuth(app); // Auth will use default endpoints

        // --- TEMPORARILY COMMENTED OUT PROXY CONFIGURATION FOR DIAGNOSIS ---
        // const firestoreHostWithServicePath = `${PROXY_HOST}/firestore`;
        // console.log(`Attempting to initialize Firestore with proxy host: ${firestoreHostWithServicePath}`);
        // db = initializeFirestore(app, {
        //   host: firestoreHostWithServicePath,
        //   ssl: true, 
        //   ignoreUndefinedProperties: true, 
        // });
        // console.log(`Firestore configured to use proxy: ${firestoreHostWithServicePath}.`);
        // --- END OF TEMPORARY PROXY COMMENT OUT ---

        // --- USING DIRECT FIRESTORE INITIALIZATION FOR DIAGNOSIS ---
        console.log("Attempting to initialize Firestore directly (proxy bypassed for diagnosis).");
        db = getFirestore(app); // Standard initialization
        // --- END OF DIRECT FIRESTORE INITIALIZATION ---
        
        console.warn("Firebase Auth and Storage are NOT configured to use any proxy with the current client SDK setup. They will use default Google endpoints.");
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
      
      // --- TEMPORARILY COMMENTED OUT PROXY CONFIGURATION FOR DIAGNOSIS ---
      // const firestoreHostWithServicePath = `${PROXY_HOST}/firestore`;
      // console.log(`Re-initializing Firestore on existing app instance with proxy host (if not already proxied): ${firestoreHostWithServicePath}`);
      // if (!db || (db && !(db.settings && (db.settings as any).host?.includes(PROXY_HOST)))) {
      //   db = initializeFirestore(app, {
      //     host: firestoreHostWithServicePath,
      //     ssl: true,
      //     ignoreUndefinedProperties: true,
      //   });
      //   console.log(`Firestore re-configured to use proxy: ${firestoreHostWithServicePath}.`);
      // } else {
      //   console.log("Firestore already initialized, possibly with proxy settings. Current host:", (db.settings as any)?.host);
      // }
      // --- END OF TEMPORARY PROXY COMMENT OUT ---

      // --- USING DIRECT FIRESTORE INITIALIZATION FOR DIAGNOSIS ---
      if (!db) { // If db wasn't initialized at all before
        console.log("Attempting to initialize Firestore directly on existing app instance (proxy bypassed for diagnosis).");
        db = getFirestore(app); // Standard initialization
      } else {
        console.log("Firestore already initialized. Current host (if custom):", (db.settings as any)?.host);
      }
      // --- END OF DIRECT FIRESTORE INITIALIZATION ---
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
  }
}

export { app, auth, db };
