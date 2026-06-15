import { initializeApp, cert, getApps, getApp, type App } from "firebase-admin/app";
import { getFirestore as _getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "./logger";

let _app: App | null = null;
let _configured = false;

export function getFirebaseApp(): App | null {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn(
      "Firebase credentials not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables."
    );
    _configured = false;
    return null;
  }

  try {
    _app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    _configured = true;
    logger.info("Firebase Admin initialized");
  } catch (err) {
    logger.error({ err }, "Firebase init failed");
    _configured = false;
  }

  return _app;
}

export function isFirebaseConfigured(): boolean {
  return _configured;
}

export function getFirestore(): Firestore {
  const app = getFirebaseApp();
  if (!app) {
    throw new Error("Firebase not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
  }
  return _getFirestore(app);
}

export default { getFirebaseApp, getFirestore, isFirebaseConfigured };
