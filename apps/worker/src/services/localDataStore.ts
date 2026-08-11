import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { COLLECTIONS, type GeneratedAsset, type GeneratedPage, type GenerationJob, type Project } from "@forgeseo/shared";
import { workerConfig } from "../config.js";

interface LocalData {
  [COLLECTIONS.projects]: Record<string, Project>;
  [COLLECTIONS.generationJobs]: Record<string, GenerationJob>;
  [COLLECTIONS.pages]: Record<string, GeneratedPage>;
  [COLLECTIONS.assets]: Record<string, GeneratedAsset>;
}

const emptyData = (): LocalData => ({
  [COLLECTIONS.projects]: {},
  [COLLECTIONS.generationJobs]: {},
  [COLLECTIONS.pages]: {},
  [COLLECTIONS.assets]: {}
});

let writeChain: Promise<void> = Promise.resolve();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const replaceFileWithRetry = async (source: string, destination: string): Promise<void> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rename(source, destination);
      return;
    } catch (error) {
      lastError = error;
      await sleep(25 * (attempt + 1));
    }
  }
  throw lastError;
};

export const useLocalDataStore = (): boolean => process.env.NODE_ENV !== "production" && workerConfig.siteStorageProvider === "local";

export class LocalDataStore {
  private readonly filePath = path.join(workerConfig.tmpRoot, "local-data.json");

  async getProject(projectId: string): Promise<Project | undefined> {
    const data = await this.read();
    return data.projects[projectId];
  }

  async getJob(jobId: string): Promise<GenerationJob | undefined> {
    const data = await this.read();
    return data.generationJobs[jobId];
  }

  async updateJob(jobId: string, updater: (job: GenerationJob) => GenerationJob): Promise<void> {
    await this.update((data) => {
      const job = data.generationJobs[jobId];
      if (!job) {
        throw new Error(`Generation job ${jobId} was not found.`);
      }
      data.generationJobs[jobId] = updater(job);
    });
  }

  async saveOutputs(pages: GeneratedPage[], assets: GeneratedAsset[]): Promise<void> {
    await this.update((data) => {
      for (const page of pages) {
        data.pages[page.id] = page;
      }
      for (const asset of assets) {
        data.assets[asset.id] = asset;
      }
    });
  }

  private async read(): Promise<LocalData> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<LocalData>;
      return {
        ...emptyData(),
        ...parsed,
        projects: parsed.projects ?? {},
        generationJobs: parsed.generationJobs ?? {},
        pages: parsed.pages ?? {},
        assets: parsed.assets ?? {}
      };
    } catch {
      return emptyData();
    }
  }

  private async update(mutator: (data: LocalData) => void): Promise<void> {
    const nextWrite = writeChain.then(async () => {
      const data = await this.read();
      mutator(data);
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
      await writeFile(tmpPath, JSON.stringify(data, null, 2));
      await replaceFileWithRetry(tmpPath, this.filePath);
    });
    writeChain = nextWrite.catch(() => undefined);
    await nextWrite;
  }
}
