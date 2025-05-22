
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
// Firebase Auth is not currently proxied or used by mock login in this version
// import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";


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
let db: Firestore | undefined = undefined;

const NGROK_HOSTNAME = "ef12-121-7-209-188.ngrok-free.app"; // Hostname only for initializeFirestore

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
        
        if (process.env.NODE_ENV === 'development') {
           console.warn(
            "DEVELOPMENT MODE: Attempting to connect Firestore to ngrok-exposed emulator. \n" +
            `Firestore host will be set to: ${NGROK_HOSTNAME} (SSL: true). \n` +
            "==> IF FIRESTORE OPERATIONS FAIL (e.g., 'unavailable' errors), PLEASE VERIFY: \n" +
            "    1. Your local Firebase Firestore emulator is running (e.g., `firebase emulators:start`).\n" +
            `    2. Your ngrok tunnel for '${NGROK_HOSTNAME}' is active and correctly points to your local Firestore emulator port (usually 8080).\n` +
            "    3. There are no firewall issues blocking the connection.\n" +
            "    4. The ngrok URL has not expired (free tier ngrok URLs are temporary).\n" +
            "    5. Check the console where your ngrok client is running for any errors or status messages."
          );
          db = initializeFirestore(app, {
            host: NGROK_HOSTNAME,
            ssl: true,
            // port is usually not needed when host includes https and ssl is true for standard 443
          });
          console.log(`Firestore configured to use ngrok host: ${NGROK_HOSTNAME}. If subsequent operations fail, check the points above.`);
        } else {
          // Production mode or non-dev environment
          db = getFirestore(app);
          console.log(`Firestore configured to use default Google endpoints (production/non-dev mode).`);
        }
        
        console.log(`Firebase initialized successfully for project ID: ${firebaseConfig.projectId}.`);

      } catch (error) {
        console.error("Firebase client initialization error during initializeApp/getFirestore:", error);
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
      if (!db) { 
        console.log("Re-initializing Firestore on existing app instance.");
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            "DEVELOPMENT MODE (existing app instance): Attempting to connect Firestore to ngrok-exposed emulator. \n" +
            `Firestore host will be set to: ${NGROK_HOSTNAME} (SSL: true). \n` +
            "==> VERIFY EMULATOR AND NGROK TUNNEL ARE ACTIVE AND CORRECTLY POINTED."
          );
          db = initializeFirestore(app, {
            host: NGROK_HOSTNAME,
            ssl: true,
          });
          console.log(`Firestore re-configured to use ngrok host (on existing app): ${NGROK_HOSTNAME}.`);
        } else {
          db = getFirestore(app);
          console.log(`Firestore re-configured to use default Google endpoints (production/non-dev mode, existing app).`);
        }
      } else {
        // Check if db instance is already configured for ngrok (e.g., during hot-reload)
        // This check is a bit tricky as Firestore instance doesn't directly expose its host easily after initialization.
        // The console logs upon initialization should serve as the primary indicator.
        console.log("Firestore instance already exists. Current configuration (ngrok or cloud) should persist from initial load.");
      }
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
    if (!db) {
        console.warn("Firestore 'db' instance is not initialized due to critical configuration errors. Firestore operations will fail.")
    }
  }
}


export { app, db }; // auth is not exported as it's not used with mock login
