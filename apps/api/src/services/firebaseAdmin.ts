import { applicationDefault, cert, initializeApp, type App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { getFirestore as getFirebaseFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { config } from "../config.js";

let app: App | undefined;
let firestore: Firestore | undefined;

export const getFirebaseAdminApp = (): App => {
  if (app) {
    return app;
  }

  const { projectId, clientEmail, privateKey, storageBucket } = config.firebase;
  if (!projectId) {
    throw new Error("Firebase Admin credentials are not configured.");
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

export const getFirestore = (): Firestore => {
  if (firestore) {
    return firestore;
  }

  firestore = getFirebaseFirestore(getFirebaseAdminApp());
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
};

export const getAuth = async (): Promise<Auth> => {
  const { getAuth: getFirebaseAuth } = await import("firebase-admin/auth");
  return getFirebaseAuth(getFirebaseAdminApp());
};

export const getStorageBucket = () => getStorage(getFirebaseAdminApp()).bucket();
