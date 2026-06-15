import { initializeApp, cert, getApps, getApp, type App } from "firebase-admin/app";
import { getFirestore as _getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "./logger";

let _app: App | null = null;

export function getFirebaseApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApp();
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn("Firebase credentials missing — running in limited mode");
    _app = initializeApp({ projectId: projectId ?? "dummy-project" });
    return _app;
  }

  _app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  logger.info("Firebase Admin initialized");
  return _app;
}

export function getFirestore(): Firestore {
  getFirebaseApp();
  return _getFirestore();
}

export default { getFirebaseApp, getFirestore };
