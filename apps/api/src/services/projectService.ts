import crypto from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import { COLLECTIONS, ENGINE_ORDER, type GenerationEngine, type GenerationJob, type Project, type ProjectWizardConfig, type StartGenerationRequest, type StartGenerationResponse, type WizardConfig } from "@forgeseo/shared";
import { config, getCapabilityState } from "../config.js";
import { PublicError } from "../middleware/errors.js";
import { scaleWorkerPool } from "./cloudRunWorkerScaler.js";
import { getFirestore } from "./firebaseAdmin.js";
import { enqueueGeneration } from "./jobQueue.js";
import { runDirectGeneration } from "./directGeneration.js";
import { scheduleBackgroundTask } from "./backgroundTasks.js";
import { LocalDataStore, useLocalDataStore } from "./localDataStore.js";
import { TemplateService } from "./templateService.js";

export class ProjectService {
  private readonly templates = new TemplateService();
  private readonly localData = new LocalDataStore();

  async getGenerationJob(userId: string, jobId: string): Promise<GenerationJob> {
    if (useLocalDataStore()) {
      const job = await this.localData.getJob(jobId);
      if (!job) {
        throw new PublicError(404, "Generation job was not found.");
      }
      if (job.userId !== userId) {
        throw new PublicError(403, "You do not have access to this generation job.");
      }
      return job;
    }

    const db = getFirestore();
    const snapshot = await db.collection(COLLECTIONS.generationJobs).doc(jobId).get();

    if (!snapshot.exists) {
      throw new PublicError(404, "Generation job was not found.");
    }

    const job = snapshot.data() as GenerationJob;
    if (job.userId !== userId) {
      throw new PublicError(403, "You do not have access to this generation job.");
    }

    return job;
  }

  async startGeneration(userId: string, request: StartGenerationRequest): Promise<StartGenerationResponse> {
    const capabilities = getCapabilityState();
    if (!capabilities.generationEnabled) {
      throw new PublicError(503, capabilities.disabledReason ?? "Website generation is not configured.");
    }

    const now = new Date().toISOString();
    const wizardConfig = await this.normalizeWizardConfig(request.wizardConfig);
    const projectId = request.projectId ?? crypto.randomUUID();

    const localStore = useLocalDataStore();
    const existingProject = localStore
      ? await this.localData.getProject(projectId)
      : undefined;

    if (existingProject && existingProject.userId !== userId) {
      throw new PublicError(403, "You do not have access to this project.");
    }

    const db = localStore ? undefined : getFirestore();
    const projectRef = localStore
      ? undefined
      : request.projectId
        ? db!.collection(COLLECTIONS.projects).doc(request.projectId)
        : db!.collection(COLLECTIONS.projects).doc(projectId);

    const existing = projectRef ? await projectRef.get() : undefined;
    if (existing?.exists && existing.get("userId") !== userId) {
      throw new PublicError(403, "You do not have access to this project.");
    }

    const project: Project = {
      id: projectRef?.id ?? projectId,
      userId,
      name: wizardConfig.businessName,
      wizardConfig,
      createdAt: existing?.exists ? String(existing.get("createdAt")) : existingProject?.createdAt ?? now,
      updatedAt: now
    };

    const jobId = crypto.randomUUID();
    const job: GenerationJob = {
      id: jobId,
      projectId: project.id,
      userId,
      status: "queued",
      progress: 0,
      currentTask: "Waiting for a worker to claim the job.",
      completedEngines: [],
      failedEngines: [],
      estimatedTimeSeconds: 360,
      elapsedSeconds: 0,
      createdAt: now,
      updatedAt: now,
      logs: [
        {
          timestamp: now,
          engine: "system",
          level: "info",
          message: "Generation job created and queued."
        }
      ],
      errors: [],
      checkpoints: ENGINE_ORDER.map((engine: GenerationEngine) => ({
        engine,
        status: "pending"
      }))
    };

    try {
      if (localStore) {
        await this.localData.saveProjectAndJob({ ...project, lastGenerationJobId: jobId }, job);
      } else if (db && projectRef) {
        await db.runTransaction(async (transaction: Transaction) => {
          transaction.set(projectRef, { ...project, lastGenerationJobId: jobId }, { merge: true });
          transaction.set(db.collection(COLLECTIONS.generationJobs).doc(jobId), job);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Firestore error.";
      console.error(`Generation job persistence failed: ${message}`);
      throw new PublicError(503, `Could not save the generation job in Firestore: ${message}`);
    }

    const generationPayload = {
      jobId,
      projectId: project.id,
      userId,
      aiProvider: request.aiProvider ?? "openai",
      aiApiKey: request.aiApiKey?.trim() || request.openAiApiKey?.trim() || undefined,
      aiModel: request.aiModel?.trim() || request.openAiModel?.trim() || undefined,
      openAiApiKey: request.openAiApiKey?.trim() || undefined,
      openAiModel: request.openAiModel?.trim() || undefined
    };

    if (config.generationMode === "direct") {
      await scheduleBackgroundTask(runDirectGeneration(generationPayload), `Direct generation job ${jobId}`);
      return {
        projectId: project.id,
        jobId,
        status: job.status
      };
    }

    try {
      await enqueueGeneration(generationPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Redis queue error.";
      console.error(`Generation job enqueue failed: ${message}`);
      throw new PublicError(503, `Could not queue the generation job in Redis: ${message}`);
    }

    try {
      await scaleWorkerPool(1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud Run worker wake-up failed.";
      console.error(message);
      if (localStore) {
        const storedJob = await this.localData.getJob(jobId);
        if (storedJob) {
          await this.localData.saveProjectAndJob({ ...project, lastGenerationJobId: jobId }, {
            ...storedJob,
            logs: [
              ...storedJob.logs,
              {
                timestamp: new Date().toISOString(),
                engine: "system",
                level: "warning",
                message: `Generation was queued, but the Cloud Run worker could not be woken automatically: ${message}`
              }
            ]
          });
        }
      } else if (db) {
        await db.collection(COLLECTIONS.generationJobs).doc(jobId).update({
          updatedAt: new Date().toISOString(),
          logs: [
            ...job.logs,
            {
              timestamp: new Date().toISOString(),
              engine: "system",
              level: "warning",
              message: `Generation was queued, but the Cloud Run worker could not be woken automatically: ${message}`
            }
          ]
        });
      }
    }

    return {
      projectId: project.id,
      jobId,
      status: job.status
    };
  }

  private async normalizeWizardConfig(input: ProjectWizardConfig): Promise<WizardConfig> {
    const templates = await this.templates.listTemplates();
    if (templates.length === 0) {
      throw new PublicError(400, "No website templates are available.");
    }
    const requestedTemplateIds = Array.from(new Set([...(input.templateIds ?? []), ...(input.templateId ? [input.templateId] : [])]));
    const selectedTemplateIds = requestedTemplateIds.length ? requestedTemplateIds : [templates[0]!.id];
    const unavailableTemplateIds = selectedTemplateIds.filter((templateId) => !templates.some((template) => template.id === templateId));
    if (unavailableTemplateIds.length > 0) {
      throw new PublicError(400, `Template "${unavailableTemplateIds[0]}" is not available.`);
    }

    const anchorLinks = [
      ...(input.anchorLinks ?? []),
      ...(input.anchorText && (input.anchorUrl || input.websiteUrl) ? [{ text: input.anchorText, url: input.anchorUrl || input.websiteUrl! }] : [])
    ].reduce<NonNullable<WizardConfig["anchorLinks"]>>((links, anchor) => {
      const text = anchor.text.trim();
      const url = anchor.url.trim();
      if (!text || !url || links.some((item) => item.text.toLowerCase() === text.toLowerCase() && item.url === url)) {
        return links;
      }
      links.push({ text, url });
      return links;
    }, []);

    const socialLinks = (input.socialLinks ?? []).reduce<NonNullable<WizardConfig["socialLinks"]>>((links, social) => {
      const url = social.url.trim();
      if (!url || links.some((item) => item.platform === social.platform)) {
        return links;
      }
      links.push({ platform: social.platform, url });
      return links;
    }, []);

    const normalizeKeywords = (keywords: Array<string | undefined>): string[] =>
      keywords.reduce<string[]>((values, keyword) => {
        const normalized = keyword?.trim();
        if (!normalized || values.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
          return values;
        }
        values.push(normalized);
        return values;
      }, []);

    const pageCount = Math.max(1, Math.min(50, input.pageCount ?? 1));
    const homePageKeywords = normalizeKeywords(input.homePageKeywords ?? []);
    const serviceKeywordGroups = Array.from({ length: pageCount }, (_, index) => {
      const configuredGroup = input.serviceKeywordGroups?.[index]?.keywords ?? [];
      const legacyKeyword = input.serviceKeywords?.[index] ?? (index === 0 ? input.dropdownLabel : undefined);
      const keywords = normalizeKeywords([...configuredGroup, legacyKeyword]);
      return { keywords: keywords.length ? keywords : [input.industry] };
    });

    const serviceKeywords = serviceKeywordGroups
      .flatMap((group) => group.keywords)
      .reduce<string[]>((keywords, keyword) => {
        const normalized = keyword?.trim();
        if (!normalized || keywords.some((item: string) => item.toLowerCase() === normalized.toLowerCase())) {
          return keywords;
        }
        keywords.push(normalized);
        return keywords;
      }, []);

    return {
      ...input,
      templateId: selectedTemplateIds[0],
      templateIds: selectedTemplateIds,
      pageCount,
      customLogoEnabled: Boolean(input.customLogoEnabled),
      logoDataUrl: input.customLogoEnabled ? input.logoDataUrl : undefined,
      logoFileName: input.customLogoEnabled ? input.logoFileName : undefined,
      homePageKeywords: homePageKeywords.length ? homePageKeywords : undefined,
      dropdownLabel: serviceKeywords[0] ?? input.dropdownLabel ?? undefined,
      serviceKeywords: serviceKeywords.length ? serviceKeywords : undefined,
      serviceKeywordGroups,
      contactAddress: input.contactAddress || input.location || undefined,
      contactHours: input.contactHours || undefined,
      contactMode: input.contactMode ?? "form",
      mapEmbedCode: input.mapEmbedCode || undefined,
      contactMapEmbedCode: input.contactMapEmbedCode || undefined,
      youtubeEmbedCode: input.youtubeEmbedCode || undefined,
      googleDocsEmbedCode: input.googleDocsEmbedCode || undefined,
      googlePresentationEmbedCode: input.googlePresentationEmbedCode || undefined,
      googleSheetsEmbedCode: input.googleSheetsEmbedCode || undefined,
      socialLinks: socialLinks.length ? socialLinks : undefined,
      anchorLinks: anchorLinks.length ? anchorLinks : undefined,
      anchorText: undefined,
      anchorUrl: undefined,
      selectedPages: input.selectedPages?.length ? Array.from(new Set(["home", ...input.selectedPages])) : undefined
    };
  }
}
