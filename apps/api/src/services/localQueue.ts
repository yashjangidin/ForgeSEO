import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { GenerationQueuePayload } from "./jobQueue.js";

interface LocalQueueItem {
  id: string;
  payload: GenerationQueuePayload;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
}

interface LocalQueueData {
  items: LocalQueueItem[];
}

const queuePath = path.join(config.localBuildRoot, "local-queue.json");

const readQueue = async (): Promise<LocalQueueData> => {
  try {
    const parsed = JSON.parse(await readFile(queuePath, "utf8")) as Partial<LocalQueueData>;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
};

const writeQueue = async (data: LocalQueueData): Promise<void> => {
  await mkdir(path.dirname(queuePath), { recursive: true });
  await writeFile(queuePath, JSON.stringify(data, null, 2));
};

export const enqueueLocalGeneration = async (payload: GenerationQueuePayload): Promise<void> => {
  const data = await readQueue();
  if (!data.items.some((item) => item.id === payload.jobId)) {
    data.items.push({
      id: payload.jobId,
      payload,
      status: "pending",
      createdAt: new Date().toISOString()
    });
  }
  await writeQueue(data);
};
