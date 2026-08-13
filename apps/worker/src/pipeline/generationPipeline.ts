import { ENGINE_ORDER, buildImageRequirements, type AiProvider, type GenerationEngine, type GenerationResult, type UserImageInput } from "@forgeseo/shared";
import { workerConfig } from "../config.js";
import { ImageGeneratorEngine, PreviewBuilderEngine, StructuredJsonGeneratorEngine, TemplateRendererEngine, ZipExportEngine } from "../engines/index.js";
import { AiGenerationService } from "../services/aiGenerationService.js";
import { ImageGenerationService } from "../services/imageGenerationService.js";
import { JobRepository } from "../services/jobRepository.js";
import { StorageService } from "../services/storageService.js";
import type { GenerationEngineRunner, GenerationState } from "./types.js";
import type { TemplateContent } from "../templates/templateContent.js";

export interface RunPipelineInput {
  jobId: string;
  projectId: string;
  userId: string;
  aiProvider?: AiProvider;
  aiApiKey?: string;
  aiModel?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  startAtEngine?: GenerationEngine;
  imageInputs?: UserImageInput[];
}

export class GenerationPipeline {
  private readonly jobs = new JobRepository();
  private readonly storage = new StorageService();

  async run(input: RunPipelineInput): Promise<void> {
    let currentEngine: (typeof ENGINE_ORDER)[number] | "system" = "system";

    try {
      if (input.startAtEngine) {
        await this.jobs.resumeAfterImages(input.jobId);
      } else {
        await this.jobs.claimJob(input.jobId);
      }
      const project = await this.jobs.loadProject(input.projectId);
      const projectWithJob = { ...project, lastGenerationJobId: input.jobId };
      const existingJob = input.startAtEngine ? await this.jobs.loadJob(input.jobId) : undefined;
      const providedImages = input.imageInputs?.length
        ? ImageGenerationService.uploadedImagesFromInputs(buildImageRequirements(project.wizardConfig), input.imageInputs)
        : undefined;
      let state: GenerationState = {
        project: projectWithJob,
        wizardConfig: project.wizardConfig,
        templateContent: existingJob?.templateContentSnapshot as TemplateContent | undefined,
        generatedImages: providedImages,
        pages: [],
        assets: [],
        artifacts: providedImages?.map((image) => ({
          relativePath: image.relativePath,
          content: image.content,
          contentType: image.contentType
        })) ?? []
      };

      const engines: GenerationEngineRunner[] = [
        new StructuredJsonGeneratorEngine(
          workerConfig.structuredJsonProvider === "openai"
            ? new AiGenerationService({
                provider: input.aiProvider ?? "openai",
                apiKey: input.aiApiKey ?? input.openAiApiKey,
                model: input.aiModel ?? input.openAiModel
              })
            : undefined
        ),
        new ImageGeneratorEngine(
          project.wizardConfig.imageSourceMode === "url" || input.aiProvider === "openai" || input.openAiApiKey || workerConfig.openAiApiKey
            ? new ImageGenerationService({
                apiKey: input.openAiApiKey ?? (input.aiProvider === "openai" ? input.aiApiKey : undefined),
                model: "gpt-image-1"
              })
            : undefined
        ),
        new TemplateRendererEngine(),
        new PreviewBuilderEngine(),
        new ZipExportEngine()
      ];
      const startIndex = input.startAtEngine ? engines.findIndex((engine) => engine.name === input.startAtEngine) : 0;
      const enginesToRun = startIndex > 0 ? engines.slice(startIndex) : engines;
      if (providedImages?.length && startIndex > ENGINE_ORDER.indexOf("image-generator")) {
        await this.jobs.completeEngine(input.jobId, "image-generator", Math.floor(((ENGINE_ORDER.indexOf("image-generator") + 1) / engines.length) * 95), `Resolved ${providedImages.length} uploaded website images.`);
      }

      for (const [index, engine] of enginesToRun.entries()) {
        currentEngine = engine.name;
        const absoluteIndex = ENGINE_ORDER.indexOf(engine.name);
        const startingProgress = Math.floor((absoluteIndex / engines.length) * 100);
        await this.jobs.startEngine(input.jobId, engine.name, startingProgress, `Running ${engine.name}.`);
        const result = await engine.run(state);
        state = result.state;
        if (result.paused?.reason === "waiting-for-images") {
          await this.jobs.waitForImages(input.jobId, result.paused.requirements, result.task, state.templateContent);
          return;
        }
        const completedProgress = Math.floor(((absoluteIndex + 1) / engines.length) * 95);
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
