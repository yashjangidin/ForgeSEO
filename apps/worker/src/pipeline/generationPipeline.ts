import { ENGINE_ORDER, type AiProvider, type GenerationResult } from "@forgeseo/shared";
import { workerConfig } from "../config.js";
import { PreviewBuilderEngine, StructuredJsonGeneratorEngine, TemplateRendererEngine, ZipExportEngine } from "../engines/index.js";
import { AiGenerationService } from "../services/aiGenerationService.js";
import { JobRepository } from "../services/jobRepository.js";
import { StorageService } from "../services/storageService.js";
import type { GenerationState } from "./types.js";

export interface RunPipelineInput {
  jobId: string;
  projectId: string;
  userId: string;
  aiProvider?: AiProvider;
  aiApiKey?: string;
  aiModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
}

export class GenerationPipeline {
  private readonly jobs = new JobRepository();
  private readonly storage = new StorageService();

  async run(input: RunPipelineInput): Promise<void> {
    let currentEngine: (typeof ENGINE_ORDER)[number] | "system" = "system";

    try {
      await this.jobs.claimJob(input.jobId);
      const project = await this.jobs.loadProject(input.projectId);
      const projectWithJob = { ...project, lastGenerationJobId: input.jobId };
      let state: GenerationState = {
        project: projectWithJob,
        wizardConfig: project.wizardConfig,
        pages: [],
        assets: [],
        artifacts: []
      };

      const engines = [
        new StructuredJsonGeneratorEngine(
          workerConfig.structuredJsonProvider === "openai"
            ? new AiGenerationService({
                provider: input.aiProvider ?? "openai",
                apiKey: input.aiApiKey ?? input.openAiApiKey,
                model: input.aiModel ?? input.openAiModel
              })
            : undefined
        ),
        new TemplateRendererEngine(),
        new PreviewBuilderEngine(),
        new ZipExportEngine()
      ];

      for (const [index, engine] of engines.entries()) {
        currentEngine = engine.name;
        const startingProgress = Math.floor((index / engines.length) * 100);
        await this.jobs.startEngine(input.jobId, engine.name, startingProgress, `Running ${engine.name}.`);
        const result = await engine.run(state);
        state = result.state;
        const completedProgress = Math.floor(((index + 1) / engines.length) * 95);
        await this.jobs.completeEngine(input.jobId, engine.name, completedProgress, result.task);
      }

      const buildDirectory = await this.storage.prepareBuildDirectory(input.jobId);
      await this.storage.writeArtifacts(buildDirectory, state.artifacts);
      const zipPath = state.zipPath ?? `${buildDirectory}.zip`;
      await this.storage.zipDirectory(buildDirectory, zipPath);
      const uploaded = await this.storage.uploadBuild(state, buildDirectory, zipPath);
      const now = new Date().toISOString();
      const assets = state.assets.map((asset) => ({ ...asset, url: `${uploaded.previewUrl.replace(/index\.html.*/, "")}${asset.path}` }));
      await this.jobs.persistOutputs(state.pages, assets);
      const result: GenerationResult = {
        previewUrl: uploaded.previewUrl,
        zipUrl: uploaded.zipUrl,
        storagePrefix: uploaded.storagePrefix,
        pageCount: state.pages.length,
        assetCount: assets.length,
        completedAt: now
      };
      await this.jobs.completeJob(input.jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed for an unknown reason.";
      await this.jobs.failJob(input.jobId, currentEngine, message);
      throw error;
    }
  }
}
