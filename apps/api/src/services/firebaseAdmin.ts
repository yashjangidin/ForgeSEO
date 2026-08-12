import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { getFirestore as getFirebaseFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { config } from "../config.js";

let app: App | undefined;
let firestore: Firestore | undefined;
let firestoreSettingsApplied = false;

const APP_NAME = "forgeseo-api";

export const getFirebaseAdminApp = (): App => {
  if (app) {
    return app;
  }

  const existingApp = getApps().find((firebaseApp) => firebaseApp.name === APP_NAME);
  if (existingApp) {
    app = existingApp;
    return app;
  }

  const { projectId, clientEmail, privateKey, storageBucket } = config.firebase;
  if (!projectId) {
    throw new Error("Firebase Admin credentials are not configured.");
  }

  try {
    app = getApp(APP_NAME);
    return app;
  } catch {
    // The named app is initialized below.
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

export const getFirestore = (): Firestore => {
  if (firestore) {
    return firestore;
  }

  firestore = getFirebaseFirestore(getFirebaseAdminApp());
  if (!firestoreSettingsApplied) {
    firestore.settings({ ignoreUndefinedProperties: true });
    firestoreSettingsApplied = true;
  }
  return firestore;
};

export const getAuth = async (): Promise<Auth> => {
  const { getAuth: getFirebaseAuth } = await import("firebase-admin/auth");
  return getFirebaseAuth(getFirebaseAdminApp());
};

export const getStorageBucket = () => getStorage(getFirebaseAdminApp()).bucket();
