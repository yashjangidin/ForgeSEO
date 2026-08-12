import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import type { CapabilityState } from "@forgeseo/shared";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDirectory, "../../..");
loadDotenv({ path: path.join(repoRoot, ".env") });

export interface ApiConfig {
  nodeEnv: string;
  port: number;
  webOrigin: string;
  redisUrl: string;
  queueProvider: "local" | "redis";
  generationMode: "queue" | "direct";
  structuredJsonProvider: "deterministic" | "openai";
  siteStorageProvider: "local" | "firebase";
  localBuildRoot: string;
  openAiApiKey?: string;
  cloudRun: {
    workerAutoscale: boolean;
    projectId?: string;
    region?: string;
    workerPool?: string;
  };
  firebase: {
    serviceAccountPath?: string;
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
    storageBucket?: string;
  };
}

const required = (value: string | undefined): string | undefined => {
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

const generationMode = (value: string | undefined): "queue" | "direct" =>
  value?.trim().toLowerCase() === "direct" ? "direct" : "queue";

interface FirebaseServiceAccountFile {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

const loadServiceAccount = (filePath: string | undefined): FirebaseServiceAccountFile => {
  const configuredPath = required(filePath) ?? ".secrets/firebase-service-account.json";
  const absolutePath = path.resolve(repoRoot, configuredPath);
  if (!existsSync(absolutePath)) {
    return {};
  }

  const parsed = JSON.parse(readFileSync(absolutePath, "utf8")) as FirebaseServiceAccountFile;
  return parsed;
};

const serviceAccount = loadServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

export const config: ApiConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 8080),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  queueProvider: queueProvider(process.env.QUEUE_PROVIDER),
  generationMode: generationMode(process.env.GENERATION_MODE),
  structuredJsonProvider: structuredJsonProvider(process.env.STRUCTURED_JSON_PROVIDER),
  siteStorageProvider: siteStorageProvider(process.env.SITE_STORAGE_PROVIDER),
  localBuildRoot: path.resolve(repoRoot, process.env.WORKER_TMP_ROOT ?? ".forgeseo-builds"),
  openAiApiKey: required(process.env.OPENAI_API_KEY),
  cloudRun: {
    workerAutoscale: process.env.CLOUD_RUN_WORKER_AUTOSCALE?.trim().toLowerCase() === "true",
    projectId: required(process.env.CLOUD_RUN_PROJECT_ID) ?? required(process.env.GOOGLE_CLOUD_PROJECT) ?? required(process.env.GCLOUD_PROJECT),
    region: required(process.env.CLOUD_RUN_REGION),
    workerPool: required(process.env.CLOUD_RUN_WORKER_POOL)
  },
  firebase: {
    serviceAccountPath: required(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) ?? ".secrets/firebase-service-account.json",
    projectId: required(process.env.FIREBASE_PROJECT_ID) ?? required(processAccountProjectId()) ?? required(serviceAccount.project_id),
    clientEmail: required(process.env.FIREBASE_CLIENT_EMAIL) ?? required(serviceAccount.client_email),
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? serviceAccount.private_key,
    storageBucket: required(process.env.FIREBASE_STORAGE_BUCKET)
  }
};

function processAccountProjectId(): string | undefined {
  return process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
}

export const useLocalQueue = (): boolean =>
  config.nodeEnv !== "production" &&
  config.siteStorageProvider === "local" &&
  config.queueProvider === "local";

export const getCapabilityState = (): CapabilityState => {
  const firebaseAdmin = Boolean(
    config.firebase.projectId &&
      ((config.firebase.clientEmail && config.firebase.privateKey) ||
        config.nodeEnv === "production" ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
  const storage = config.siteStorageProvider === "local" || Boolean(firebaseAdmin && config.firebase.storageBucket);
  const redis = config.generationMode === "direct" || useLocalQueue() || Boolean(config.redisUrl);
  const openai = Boolean(config.openAiApiKey) || config.structuredJsonProvider === "openai";
  const structuredJson = config.structuredJsonProvider === "deterministic" || openai;
  const generationEnabled = firebaseAdmin && storage && redis && structuredJson;
  const missing = [
    firebaseAdmin ? undefined : "Firebase Admin credentials",
    storage ? undefined : "Storage provider",
    redis ? undefined : "Redis URL, local queue, or direct generation mode",
    structuredJson ? undefined : "Structured JSON generator"
  ].filter((item): item is string => Boolean(item));

  return {
    firebaseAdmin,
    redis,
    structuredJson,
    openai,
    storage,
    generationEnabled,
    disabledReason: generationEnabled
      ? undefined
      : `Generation is disabled until these integrations are configured: ${missing.join(", ")}.`
  };
};
