import type { Transaction } from "firebase-admin/firestore";
import { COLLECTIONS, type GeneratedAsset, type GeneratedPage, type GenerationEngine, type GenerationJob, type GenerationResult, type ImageRequirement, type JobLogEntry, type Project } from "@forgeseo/shared";
import { firestore } from "../firebaseAdmin.js";
import { LocalDataStore, useLocalDataStore } from "./localDataStore.js";

const firestoreSafeSnapshot = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

export class JobRepository {
  private readonly localData = new LocalDataStore();

  private get db() {
    return firestore();
  }

  async loadProject(projectId: string): Promise<Project> {
    if (useLocalDataStore()) {
      const project = await this.localData.getProject(projectId);
      if (!project) {
        throw new Error(`Project ${projectId} was not found.`);
      }
      return project;
    }

    const snapshot = await this.db.collection(COLLECTIONS.projects).doc(projectId).get();
    if (!snapshot.exists) {
      throw new Error(`Project ${projectId} was not found.`);
    }
    return snapshot.data() as Project;
  }

  async claimJob(jobId: string): Promise<void> {
    const now = new Date().toISOString();
    if (useLocalDataStore()) {
      await this.localData.updateJob(jobId, (job) => ({
        ...job,
        status: "claimed",
        startedAt: now,
        updatedAt: now,
        currentTask: "Worker claimed the job."
      }));
      return;
    }

    await this.db.collection(COLLECTIONS.generationJobs).doc(jobId).update({
      status: "claimed",
      startedAt: now,
      updatedAt: now,
      currentTask: "Worker claimed the job."
    });
  }

  async startEngine(jobId: string, engine: GenerationEngine, progress: number, task: string): Promise<void> {
    await this.patchJob(jobId, {
      status: "running",
      currentEngine: engine,
      currentTask: task,
      progress
    });
    await this.updateCheckpoint(jobId, engine, "running");
    await this.addLog(jobId, engine, "info", task);
  }

  async completeEngine(jobId: string, engine: GenerationEngine, progress: number, task: string): Promise<void> {
    if (useLocalDataStore()) {
      await this.localData.updateJob(jobId, (job) => ({
        ...this.withCheckpoint(job, engine, "completed"),
        completedEngines: Array.from(new Set([...job.completedEngines, engine])),
        currentTask: task,
        progress,
        updatedAt: new Date().toISOString()
      }));
      await this.addLog(jobId, engine, "info", task);
      return;
    }

    const jobRef = this.db.collection(COLLECTIONS.generationJobs).doc(jobId);
    await this.db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(jobRef);
      const current = snapshot.data() as GenerationJob | undefined;
      const completed = new Set(current?.completedEngines ?? []);
      completed.add(engine);
      transaction.update(jobRef, {
        completedEngines: Array.from(completed),
        currentTask: task,
        progress,
        updatedAt: new Date().toISOString()
      });
    });
    await this.updateCheckpoint(jobId, engine, "completed");
    await this.addLog(jobId, engine, "info", task);
  }

  async waitForImages(jobId: string, requirements: ImageRequirement[], task: string, templateContentSnapshot?: unknown): Promise<void> {
    const safeTemplateContentSnapshot = templateContentSnapshot ? firestoreSafeSnapshot(templateContentSnapshot) : undefined;
    await this.patchJob(jobId, {
      status: "waiting-for-images",
      currentEngine: "image-generator",
      currentTask: task,
      progress: 20,
      imageRequirements: requirements,
      imageSourceMode: "prompt-upload",
      ...(safeTemplateContentSnapshot ? { templateContentSnapshot: safeTemplateContentSnapshot } : {})
    });
    await this.addLog(jobId, "image-generator", "info", task);
  }

  async loadJob(jobId: string): Promise<GenerationJob> {
    if (useLocalDataStore()) {
      const job = await this.localData.getJob(jobId);
      if (!job) {
        throw new Error(`Generation job ${jobId} was not found.`);
      }
      return job;
    }

    const snapshot = await this.db.collection(COLLECTIONS.generationJobs).doc(jobId).get();
    if (!snapshot.exists) {
      throw new Error(`Generation job ${jobId} was not found.`);
    }
    return snapshot.data() as GenerationJob;
  }

  async resumeAfterImages(jobId: string): Promise<void> {
    await this.patchJob(jobId, {
      status: "running",
      currentEngine: "image-generator",
      currentTask: "Uploaded images received. Continuing generation."
    });
    await this.addLog(jobId, "image-generator", "info", "Uploaded images received. Continuing generation.");
  }

  async failJob(jobId: string, engine: GenerationEngine | "system", message: string): Promise<void> {
    if (useLocalDataStore()) {
      await this.localData.updateJob(jobId, (job) => ({
        ...job,
        status: "failed",
        currentTask: "Generation failed.",
        failedEngines: engine === "system" ? job.failedEngines : Array.from(new Set([...job.failedEngines, engine])),
        errors: [...job.errors, message],
        updatedAt: new Date().toISOString()
      }));
      await this.addLog(jobId, engine, "error", message);
      return;
    }

    const jobRef = this.db.collection(COLLECTIONS.generationJobs).doc(jobId);
    await this.db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(jobRef);
      const current = snapshot.data() as GenerationJob | undefined;
      const failed = new Set(current?.failedEngines ?? []);
      if (engine !== "system") {
        failed.add(engine);
      }
      transaction.update(jobRef, {
        status: "failed",
        currentTask: "Generation failed.",
        failedEngines: Array.from(failed),
        errors: [...(current?.errors ?? []), message],
        updatedAt: new Date().toISOString()
      });
    });
    await this.addLog(jobId, engine, "error", message);
  }

  async completeJob(jobId: string, result: GenerationResult): Promise<void> {
    if (useLocalDataStore()) {
      await this.localData.updateJob(jobId, (job) => ({
        ...job,
        status: "completed",
        progress: 100,
        currentTask: "Preview and download are available.",
        result,
        updatedAt: new Date().toISOString()
      }));
      return;
    }

    await this.db.collection(COLLECTIONS.generationJobs).doc(jobId).update({
      status: "completed",
      progress: 100,
      currentTask: "Preview and download are available.",
      result,
      updatedAt: new Date().toISOString()
    });
  }

  async persistOutputs(pages: GeneratedPage[], assets: GeneratedAsset[]): Promise<void> {
    if (useLocalDataStore()) {
      await this.localData.saveOutputs(pages, assets);
      return;
    }

    const batch = this.db.batch();
    for (const page of pages) {
      batch.set(this.db.collection(COLLECTIONS.pages).doc(page.id), page);
    }
    for (const asset of assets) {
      batch.set(this.db.collection(COLLECTIONS.assets).doc(asset.id), asset);
    }
    await batch.commit();
  }

  private async patchJob(jobId: string, data: Partial<GenerationJob> & Record<string, unknown>): Promise<void> {
    if (useLocalDataStore()) {
      await this.localData.updateJob(jobId, (job) => ({
        ...job,
        ...data,
        updatedAt: new Date().toISOString()
      }));
      return;
    }

    await this.db.collection(COLLECTIONS.generationJobs).doc(jobId).update({
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  private async updateCheckpoint(jobId: string, engine: GenerationEngine, status: "running" | "completed" | "failed"): Promise<void> {
    if (useLocalDataStore()) {
      await this.localData.updateJob(jobId, (job) => this.withCheckpoint(job, engine, status));
      return;
    }

    const jobRef = this.db.collection(COLLECTIONS.generationJobs).doc(jobId);
    await this.db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(jobRef);
      const current = snapshot.data() as GenerationJob | undefined;
      const now = new Date().toISOString();
      const checkpoints = (current?.checkpoints ?? []).map((checkpoint) => {
        if (checkpoint.engine !== engine) {
          return checkpoint;
        }

        return {
          engine: checkpoint.engine,
          status,
          ...(status === "running"
            ? { startedAt: now }
            : checkpoint.startedAt
              ? { startedAt: checkpoint.startedAt }
              : {}),
          ...(status !== "running" ? { completedAt: now } : {})
        };
      });
      transaction.update(jobRef, { checkpoints, updatedAt: new Date().toISOString() });
    });
  }

  private async addLog(
    jobId: string,
    engine: GenerationEngine | "system",
    level: JobLogEntry["level"],
    message: string
  ): Promise<void> {
    if (useLocalDataStore()) {
      await this.localData.updateJob(jobId, (job) => ({
        ...job,
        logs: [
          ...job.logs,
          {
            timestamp: new Date().toISOString(),
            engine,
            level,
            message
          }
        ].slice(-250),
        updatedAt: new Date().toISOString()
      }));
      return;
    }

    const jobRef = this.db.collection(COLLECTIONS.generationJobs).doc(jobId);
    await this.db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(jobRef);
      const current = snapshot.data() as GenerationJob | undefined;
      const logs = current?.logs ?? [];
      transaction.update(jobRef, {
        logs: [
          ...logs,
          {
            timestamp: new Date().toISOString(),
            engine,
            level,
            message
          }
        ].slice(-250),
        updatedAt: new Date().toISOString()
      });
    });
  }

  private withCheckpoint(job: GenerationJob, engine: GenerationEngine, status: "running" | "completed" | "failed"): GenerationJob {
    const now = new Date().toISOString();
    return {
      ...job,
      checkpoints: job.checkpoints.map((checkpoint) => {
        if (checkpoint.engine !== engine) {
          return checkpoint;
        }

        return {
          engine: checkpoint.engine,
          status,
          ...(status === "running"
            ? { startedAt: now }
            : checkpoint.startedAt
              ? { startedAt: checkpoint.startedAt }
              : {}),
          ...(status !== "running" ? { completedAt: now } : {})
        };
      }),
      updatedAt: now
    };
  }
}
