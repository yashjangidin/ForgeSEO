import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore as getFirebaseFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { workerConfig } from "./config.js";

let app: App | undefined;
let db: Firestore | undefined;
let firestoreSettingsApplied = false;

const APP_NAME = "forgeseo-worker";

export const getFirebaseApp = (): App => {
  if (app) {
    return app;
  }

  const existingApp = getApps().find((firebaseApp) => firebaseApp.name === APP_NAME);
  if (existingApp) {
    app = existingApp;
    return app;
  }

  const { projectId, clientEmail, privateKey, storageBucket } = workerConfig.firebase;
  if (!projectId || !storageBucket) {
    throw new Error("Firebase Admin and Storage credentials are required.");
  }

  try {
    app = getApp(APP_NAME);
    return app;
  } catch {
    // The named worker app is initialized below.
  }

  app = initializeApp({
    credential: clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault(),
    projectId,
    storageBucket
  }, APP_NAME);

  return app;
};

export const firestore = (): Firestore => {
  if (db) {
    return db;
  }

  db = getFirebaseFirestore(getFirebaseApp());
  if (!firestoreSettingsApplied) {
    db.settings({ ignoreUndefinedProperties: true });
    firestoreSettingsApplied = true;
  }
  return db;
};

export const storageBucket = () => getStorage(getFirebaseApp()).bucket();
