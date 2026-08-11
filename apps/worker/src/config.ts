import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDirectory, "../../..");
loadDotenv({ path: path.join(repoRoot, ".env") });

const read = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const structuredJsonProvider = (value: string | undefined): "deterministic" | "openai" => {
  const provider = value?.trim().toLowerCase();
  return provider === "deterministic" ? provider : "openai";
};

const siteStorageProvider = (value: string | undefined): "local" | "firebase" =>
  value?.trim().toLowerCase() === "firebase" ? "firebase" : "local";

const queueProvider = (value: string | undefined): "local" | "redis" =>
  value?.trim().toLowerCase() === "redis" ? "redis" : "local";

interface FirebaseServiceAccountFile {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

const loadServiceAccount = (filePath: string | undefined): FirebaseServiceAccountFile => {
  const configuredPath = read(filePath) ?? ".secrets/firebase-service-account.json";
  const absolutePath = path.resolve(repoRoot, configuredPath);
  if (!existsSync(absolutePath)) {
    return {};
  }

  return JSON.parse(readFileSync(absolutePath, "utf8")) as FirebaseServiceAccountFile;
};

const serviceAccount = loadServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

export const workerConfig = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  queueProvider: queueProvider(process.env.QUEUE_PROVIDER),
  structuredJsonProvider: structuredJsonProvider(process.env.STRUCTURED_JSON_PROVIDER),
  siteStorageProvider: siteStorageProvider(process.env.SITE_STORAGE_PROVIDER),
  apiPublicUrl: read(process.env.API_PUBLIC_URL) ?? `http://localhost:${process.env.API_PORT ?? 8080}`,
  openAiApiKey: read(process.env.OPENAI_API_KEY),
  openAiModel: read(process.env.OPENAI_MODEL) ?? "gpt-5-mini",
  cloudRun: {
    workerAutoscale: process.env.CLOUD_RUN_WORKER_AUTOSCALE?.trim().toLowerCase() === "true",
    projectId: read(process.env.CLOUD_RUN_PROJECT_ID) ?? read(process.env.GOOGLE_CLOUD_PROJECT) ?? read(process.env.GCLOUD_PROJECT),
    region: read(process.env.CLOUD_RUN_REGION),
    workerPool: read(process.env.CLOUD_RUN_WORKER_POOL),
    idleShutdownSeconds: Number(process.env.WORKER_IDLE_SHUTDOWN_SECONDS ?? 180)
  },
  firebase: {
    serviceAccountPath: read(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) ?? ".secrets/firebase-service-account.json",
    projectId: read(process.env.FIREBASE_PROJECT_ID) ?? read(process.env.GOOGLE_CLOUD_PROJECT) ?? read(process.env.GCLOUD_PROJECT) ?? read(serviceAccount.project_id),
    clientEmail: read(process.env.FIREBASE_CLIENT_EMAIL) ?? read(serviceAccount.client_email),
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? serviceAccount.private_key,
    storageBucket: read(process.env.FIREBASE_STORAGE_BUCKET)
  },
  tmpRoot: path.resolve(repoRoot, process.env.WORKER_TMP_ROOT ?? ".forgeseo-builds")
};

export const useLocalQueue = (): boolean =>
  process.env.NODE_ENV !== "production" &&
  workerConfig.siteStorageProvider === "local" &&
  workerConfig.queueProvider === "local";

export const assertWorkerConfigured = (): void => {
  const missing = [
    workerConfig.firebase.projectId ? undefined : "FIREBASE_PROJECT_ID or GOOGLE_CLOUD_PROJECT",
    workerConfig.firebase.clientEmail && !workerConfig.firebase.privateKey ? "FIREBASE_PRIVATE_KEY" : undefined,
    workerConfig.firebase.privateKey && !workerConfig.firebase.clientEmail ? "FIREBASE_CLIENT_EMAIL" : undefined,
    workerConfig.siteStorageProvider === "firebase" && !workerConfig.firebase.storageBucket ? "FIREBASE_STORAGE_BUCKET" : undefined,
    useLocalQueue() || workerConfig.redisUrl ? undefined : "REDIS_URL or local queue"
  ].filter((item): item is string => Boolean(item));

  if (missing.length > 0) {
    throw new Error(`Worker is not configured. Missing: ${missing.join(", ")}`);
  }
};
