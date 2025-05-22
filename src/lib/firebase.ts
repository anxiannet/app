
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
// Firebase Auth is not currently proxied or used by mock login in this version
// import { getAuth, type Auth } from "firebase/auth";
// Firestore is being removed
// import { getFirestore, initializeFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

let app: FirebaseApp | undefined = undefined;
// let auth: Auth | undefined = undefined; // Auth not used with mock login
// let db: Firestore | undefined = undefined; // Firestore removed

const NGROK_HOSTNAME = "ef12-121-7-209-188.ngrok-free.app"; // Hostname only

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
      "CRITICAL Firebase Client SDK Initialization Error: NEXT_PUBLIC_FIREBASE_API_KEY is MISSING or UNDEFINED in the configuration object. \n" +
      "ACTION REQUIRED: \n" +
      "1. For LOCAL DEVELOPMENT: Ensure it is correctly set in your .env.local file (in the project root) AND that your Next.js development server has been RESTARTED after any changes to .env.local. \n" +
      "2. For DEPLOYMENT: Ensure this NEXT_PUBLIC_FIREBASE_API_KEY environment variable is correctly set in your Firebase Hosting build environment / CI/CD settings."
    );
    criticalConfigMissing = true;
  }

  if (!firebaseConfig.projectId) {
    console.error(
      "CRITICAL Firebase Client SDK Initialization Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is MISSING or UNDEFINED in the configuration object. \n" +
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
        console.log(`Firebase initialized successfully for project ID: ${firebaseConfig.projectId}. Firestore NOT initialized as per user request.`);
        // Firestore initialization removed
        // if (process.env.NODE_ENV === 'development') {
        //    console.warn(
        //     "DEVELOPMENT MODE: Firestore would be configured to use ngrok host IF IT WAS ENABLED. \n" +
        //     `Intended Firestore host: ${NGROK_HOSTNAME} (SSL: true). \n`
        //   );
        //   // db = initializeFirestore(app, {
        //   //   host: NGROK_HOSTNAME, // Only domain, no "https://"" or path
        //   //   ssl: true,
        //   // });
        //   // console.log(`Firestore configured to use ngrok host: ${NGROK_HOSTNAME}.`);
        // } else {
        //   // Production mode or non-dev environment
        //   // db = getFirestore(app);
        //   // console.log(`Firestore configured to use default Google endpoints (production/non-dev mode).`);
        // }
      } catch (error) {
        console.error("Firebase client app initialization error:", error);
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
      console.log("Firebase app instance already exists. Firestore NOT initialized as per user request.");
      // Firestore re-initialization logic removed
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
  }
}


export { app }; // db is not exported
