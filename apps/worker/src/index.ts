import { Queue, Worker } from "bullmq";
import { Redis as IORedis } from "ioredis";
import type { AiProvider } from "@forgeseo/shared";
import { assertWorkerConfigured, useLocalQueue, workerConfig } from "./config.js";
import { GenerationPipeline } from "./pipeline/generationPipeline.js";
import { scaleWorkerPool } from "./services/cloudRunWorkerScaler.js";
import { LocalQueue } from "./services/localQueue.js";

assertWorkerConfigured();

const pipeline = new GenerationPipeline();

if (useLocalQueue()) {
  const queue = new LocalQueue();
  let running = false;

  const poll = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      const item = await queue.claimNext();
      if (item) {
        try {
          await pipeline.run(item.payload);
          await queue.markCompleted(item.id);
          console.info(`Generation job ${item.id} completed.`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed.";
          await queue.markFailed(item.id, message);
          console.error(`Generation job ${item.id} failed: ${message}`);
        }
      }
    } finally {
      running = false;
    }
  };

  setInterval(() => {
    void poll();
  }, 1000);
  void poll();
  console.info("ForgeSEO worker is listening for local website-generation jobs.");
} else {
  const connection = new IORedis(workerConfig.redisUrl, {
    maxRetriesPerRequest: null
  });
  const queue = new Queue("website-generation", { connection });

  let idleShutdownTimer: ReturnType<typeof setTimeout> | undefined;
  const idleShutdownMs = Math.max(30, workerConfig.cloudRun.idleShutdownSeconds) * 1000;
  const scheduleIdleShutdown = (): void => {
    if (!workerConfig.cloudRun.workerAutoscale) {
      return;
    }

    if (idleShutdownTimer) {
      clearTimeout(idleShutdownTimer);
    }

    idleShutdownTimer = setTimeout(() => {
      void (async () => {
        const counts = await queue.getJobCounts("waiting", "active", "delayed", "prioritized", "waiting-children");
        const unfinishedJobs = Object.values(counts).reduce((total, count) => total + count, 0);
        if (unfinishedJobs > 0) {
          scheduleIdleShutdown();
          return;
        }

        console.info("No queued generation work remains. Scaling ForgeSEO worker pool to 0 instances.");
        await scaleWorkerPool(0);
      })().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Worker idle shutdown failed.";
        console.error(message);
        scheduleIdleShutdown();
      });
    }, idleShutdownMs);
  };

  const worker = new Worker(
    "website-generation",
    async (job) => {
      const payload = job.data as {
        jobId: string;
        projectId: string;
        userId: string;
        aiProvider?: AiProvider;
        aiApiKey?: string;
        aiModel?: string;
        openAiApiKey?: string;
        openAiModel?: string;
      };
      await pipeline.run(payload);
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 1000 * 60 * 10
    }
  );

  worker.on("completed", (job) => {
    console.info(`Generation job ${job.id} completed.`);
    scheduleIdleShutdown();
  });

  worker.on("failed", (job, error) => {
    console.error(`Generation job ${job?.id ?? "unknown"} failed: ${error.message}`);
    scheduleIdleShutdown();
  });

  worker.on("drained", () => {
    scheduleIdleShutdown();
  });

  scheduleIdleShutdown();
  console.info("ForgeSEO worker is listening for Redis website-generation jobs.");
}
