import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { workerConfig } from "../config.js";

import type { AiProvider } from "@forgeseo/shared";

export interface LocalGenerationQueuePayload {
  jobId: string;
  projectId: string;
  userId: string;
  aiProvider?: AiProvider;
  aiApiKey?: string;
  aiModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
}

interface LocalQueueItem {
  id: string;
  payload: LocalGenerationQueuePayload;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
}

interface LocalQueueData {
  items: LocalQueueItem[];
}

export class LocalQueue {
  private readonly filePath = path.join(workerConfig.tmpRoot, "local-queue.json");

  async claimNext(): Promise<LocalQueueItem | undefined> {
    let claimed: LocalQueueItem | undefined;
    await this.update((data) => {
      const item = data.items.find((entry) => entry.status === "pending");
      if (!item) {
        return;
      }
      item.status = "running";
      item.claimedAt = new Date().toISOString();
      claimed = { ...item, payload: { ...item.payload } };
    });
    return claimed;
  }

  async markCompleted(jobId: string): Promise<void> {
    await this.update((data) => {
      const item = data.items.find((entry) => entry.id === jobId);
      if (item) {
        item.status = "completed";
        item.completedAt = new Date().toISOString();
      }
    });
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.update((data) => {
      const item = data.items.find((entry) => entry.id === jobId);
      if (item) {
        item.status = "failed";
        item.failedAt = new Date().toISOString();
        item.error = error;
      }
    });
  }

  private async read(): Promise<LocalQueueData> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<LocalQueueData>;
      return { items: Array.isArray(parsed.items) ? parsed.items : [] };
    } catch {
      return { items: [] };
    }
  }

  private async update(mutator: (data: LocalQueueData) => void): Promise<void> {
    const data = await this.read();
    mutator(data);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2));
  }
}
