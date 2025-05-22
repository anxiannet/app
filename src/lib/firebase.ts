
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

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
let db: Firestore | undefined = undefined;

const FIRESTORE_EMULATOR_HOST = "localhost";
const FIRESTORE_EMULATOR_PORT = 8080;

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
        
        console.log("Attempting to initialize Firestore.");
        db = getFirestore(app);
        console.log(`Firestore configured to use default Google endpoints initially.`);

        if (process.env.NODE_ENV === 'development') {
          try {
            console.log(`Connecting to Firestore emulator at ${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`);
            connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
            console.log(`Firestore successfully connected to emulator.`);
          } catch (emulatorError) {
            console.error(`Failed to connect Firestore to emulator at ${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}. Ensure the emulator is running. Error:`, emulatorError);
            // Fallback to cloud Firestore if emulator connection fails but app is initialized
          }
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
      
      if (!db) { // Check if db specifically is not initialized
        console.log("Re-initializing Firestore on existing app instance.");
        db = getFirestore(app);
        console.log(`Firestore re-configured to use default Google endpoints.`);
         if (process.env.NODE_ENV === 'development') {
          try {
            console.log(`Connecting to Firestore emulator at ${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT} (on existing app)`);
            connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
            console.log(`Firestore successfully connected to emulator (on existing app).`);
          } catch (emulatorError) {
            console.error(`Failed to connect Firestore to emulator at ${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT} (on existing app). Ensure the emulator is running. Error:`, emulatorError);
          }
        }
      } else {
        // Check if db exists but not connected to emulator, for hot-reloads
        // @ts-ignore // Accessing private _settings for check, not ideal but for dev convenience
        if (process.env.NODE_ENV === 'development' && db && (!db._settings || (db._settings.host !== `${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}` && db._settings.host !== FIRESTORE_EMULATOR_HOST) ) ) {
             try {
                console.log(`Re-connecting to Firestore emulator due to changed settings or hot-reload at ${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`);
                connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
                console.log(`Firestore successfully re-connected to emulator.`);
            } catch (emulatorError) {
                console.error(`Failed to re-connect Firestore to emulator at ${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}. Ensure the emulator is running. Error:`, emulatorError);
            }
        } else if (process.env.NODE_ENV === 'development'){
          console.log("Firestore already initialized and likely connected to emulator.");
        } else {
          console.log("Firestore already initialized.");
        }
      }
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
  }
}

export { app, db };
