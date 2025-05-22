
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
// Firebase Auth is not currently proxied or used by mock login in this version
// import { getAuth, type Auth } from "firebase/auth";

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

const NGROK_EMULATOR_URL = "ef12-121-7-209-188.ngrok-free.app"; // Hostname only
const NGROK_EMULATOR_PORT = 443; // Default HTTPS port

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
        
        // Firestore initialization using initializeFirestore for custom settings
        db = initializeFirestore(app, {
          // No host override here initially, will connect to emulator below if in dev mode
        });
        console.log(`Firestore configured to use default Google endpoints initially.`);

        if (process.env.NODE_ENV === 'development') {
          console.warn(
            "DEVELOPMENT MODE DETECTED: Attempting to connect Firestore to emulator via ngrok at " +
            `https://${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. \n` +
            "==> IF FIRESTORE OPERATIONS FAIL WITH '[code=unavailable]' OR CONNECTION ERRORS, PLEASE VERIFY: \n" +
            "    1. Your local Firebase Firestore emulator is running (e.g., `firebase emulators:start`).\n" +
            `    2. Your ngrok tunnel for '${NGROK_EMULATOR_URL}' is active and correctly points to your local Firestore emulator port (usually 8080).\n` +
            "    3. There are no firewall issues blocking the connection.\n" +
            "    4. The ngrok URL has not expired (free tier ngrok URLs are temporary).\n" +
            "    5. Check the console where your ngrok client is running for any errors or status messages."
          );
          try {
            connectFirestoreEmulator(db, NGROK_EMULATOR_URL, NGROK_EMULATOR_PORT, { ssl: true });
            console.log(`Firestore SDK has been configured to attempt connection to ngrok emulator: https://${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. If subsequent operations fail with 'unavailable', check the points above.`);
          } catch (emulatorError) {
            console.error(`CRITICAL ERROR during Firestore SDK configuration for emulator: Failed to set up connection to ngrok emulator at ${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. This usually indicates a problem with the parameters passed to connectFirestoreEmulator or an internal SDK issue. Error:`, emulatorError);
            console.error("Ensure the ngrok tunnel and emulator are running. The application might fall back to cloud Firestore or fail if this configuration step itself has an issue.");
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
      
      if (!db) { 
        console.log("Re-initializing Firestore on existing app instance.");
        db = initializeFirestore(app, {});
        console.log(`Firestore re-configured to use default Google endpoints initially (existing app).`);

         if (process.env.NODE_ENV === 'development') {
           console.warn(
            "DEVELOPMENT MODE DETECTED (existing app): Attempting to connect Firestore to emulator via ngrok at " +
            `https://${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. \n` +
            "==> IF FIRESTORE OPERATIONS FAIL WITH '[code=unavailable]' OR CONNECTION ERRORS, PLEASE VERIFY: \n" +
            "    1. Your local Firebase Firestore emulator is running (e.g., `firebase emulators:start`).\n" +
            `    2. Your ngrok tunnel for '${NGROK_EMULATOR_URL}' is active and correctly points to your local Firestore emulator port (usually 8080).\n` +
            "    3. There are no firewall issues blocking the connection.\n" +
            "    4. The ngrok URL has not expired (free tier ngrok URLs are temporary).\n" +
            "    5. Check the console where your ngrok client is running for any errors or status messages."
          );
          try {
            connectFirestoreEmulator(db, NGROK_EMULATOR_URL, NGROK_EMULATOR_PORT, { ssl: true });
            console.log(`Firestore SDK has been re-configured to attempt connection to ngrok emulator (on existing app): https://${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. If subsequent operations fail with 'unavailable', check the points above.`);
          } catch (emulatorError) {
            console.error(`CRITICAL ERROR during Firestore SDK re-configuration for emulator: Failed to set up connection to ngrok emulator at ${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT} (on existing app). Error:`, emulatorError);
            console.error("Ensure the ngrok tunnel and emulator are running. The application might fall back to cloud Firestore or fail if this configuration step itself has an issue.");
          }
        }
      } else {
        // @ts-ignore 
        if (process.env.NODE_ENV === 'development' && db && (!db.toJSON || (db.toJSON().settings && db.toJSON().settings.host !== NGROK_EMULATOR_URL && db.toJSON().settings.port !== NGROK_EMULATOR_PORT))) { 
             console.warn(
                "DEVELOPMENT MODE DETECTED (hot-reload/existing db instance): Attempting to connect Firestore to emulator via ngrok at " +
                `https://${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. \n` +
                "==> IF FIRESTORE OPERATIONS FAIL WITH '[code=unavailable]' OR CONNECTION ERRORS, PLEASE VERIFY: \n" +
                "    1. Your local Firebase Firestore emulator is running (e.g., `firebase emulators:start`).\n" +
                `    2. Your ngrok tunnel for '${NGROK_EMULATOR_URL}' is active and correctly points to your local Firestore emulator port (usually 8080).\n` +
                "    3. There are no firewall issues blocking the connection.\n" +
                "    4. The ngrok URL has not expired (free tier ngrok URLs are temporary).\n" +
                "    5. Check the console where your ngrok client is running for any errors or status messages."
             );
             try {
                connectFirestoreEmulator(db, NGROK_EMULATOR_URL, NGROK_EMULATOR_PORT, { ssl: true });
                console.log(`Firestore SDK has been re-configured to attempt connection to ngrok emulator (hot-reload): https://${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. If subsequent operations fail with 'unavailable', check the points above.`);
            } catch (emulatorError) {
                console.error(`CRITICAL ERROR during Firestore SDK re-configuration for emulator (hot-reload): Failed to set up connection to ngrok emulator at ${NGROK_EMULATOR_URL}:${NGROK_EMULATOR_PORT}. Error:`, emulatorError);
                console.error("Ensure the ngrok tunnel and emulator are running. The application might fall back to cloud Firestore or fail if this configuration step itself has an issue.");
            }
        } else if (process.env.NODE_ENV === 'development'){
          // @ts-ignore
          if (db && db.toJSON && db.toJSON().settings && db.toJSON().settings.host === NGROK_EMULATOR_URL) {
             console.log("Firestore already initialized and configured for ngrok emulator.");
          } else {
             console.log("Firestore already initialized (likely for cloud, or emulator check not applicable).");
          }
        } else {
          console.log("Firestore already initialized (production mode).");
        }
      }
    }
  } else {
    console.error("Firebase initialization SKIPPED due to missing critical configuration (API Key or Project ID). The app will not function correctly.");
    // To prevent errors if db is used when not initialized.
    if (!db) {
        console.warn("Firestore 'db' instance is not initialized due to critical configuration errors. Firestore operations will fail.")
    }
  }
}


export { app, db }; // auth is not exported as it's not used with mock login

    