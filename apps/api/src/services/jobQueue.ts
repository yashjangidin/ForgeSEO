import { Queue, type Queue as BullQueue } from "bullmq";
import IORedis from "ioredis";
import type { AiProvider } from "@forgeseo/shared";
import { config, useLocalQueue } from "../config.js";
import { enqueueLocalGeneration } from "./localQueue.js";

export interface GenerationQueuePayload {
  jobId: string;
  projectId: string;
  userId: string;
  aiProvider?: AiProvider;
  aiApiKey?: string;
  aiModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
}

let generationQueue: BullQueue<GenerationQueuePayload> | undefined;

const getGenerationQueue = (): BullQueue<GenerationQueuePayload> => {
  if (generationQueue) {
    return generationQueue;
  }

  const connection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null
  });

  generationQueue = new Queue<GenerationQueuePayload>("website-generation", {
    connection,
    defaultJobOptions: {
      attempts: 1,
      backoff: {
        type: "exponential",
        delay: 5000
      },
      removeOnComplete: {
        age: 60 * 60 * 24
      },
      removeOnFail: false
    }
  });

  return generationQueue;
};

export const enqueueGeneration = async (payload: GenerationQueuePayload): Promise<void> => {
  if (useLocalQueue()) {
    await enqueueLocalGeneration(payload);
    return;
  }

  await getGenerationQueue().add("generate-website", payload, {
    jobId: payload.jobId
  });
};
