import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore as getFirebaseFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { workerConfig } from "./config.js";

let app: App | undefined;
let db: Firestore | undefined;

export const getFirebaseApp = (): App => {
  if (app) {
    return app;
  }

  const existingApp = getApps()[0];
  if (existingApp) {
    app = existingApp;
    return app;
  }

  const { projectId, clientEmail, privateKey, storageBucket } = workerConfig.firebase;
  if (!projectId || !storageBucket) {
    throw new Error("Firebase Admin and Storage credentials are required.");
  }

  app = initializeApp({
    credential: clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault(),
    projectId,
    storageBucket
  });

  return app;
};

export const firestore = (): Firestore => {
  if (db) {
    return db;
  }

  db = getFirebaseFirestore(getFirebaseApp());
  db.settings({ ignoreUndefinedProperties: true });
  return db;
};

export const storageBucket = () => getStorage(getFirebaseApp()).bucket();
