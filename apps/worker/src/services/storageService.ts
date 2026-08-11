import { createWriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import { type BuildArtifact, type GenerationState } from "../pipeline/types.js";
import { storageBucket } from "../firebaseAdmin.js";
import { workerConfig } from "../config.js";

export class StorageService {
  async prepareBuildDirectory(jobId: string): Promise<string> {
    const directory = path.join(workerConfig.tmpRoot, jobId);
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
    return directory;
  }

  async writeArtifacts(directory: string, artifacts: BuildArtifact[]): Promise<void> {
    for (const artifact of artifacts) {
      const target = path.join(directory, artifact.relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, artifact.content);
    }
  }

  async zipDirectory(directory: string, zipPath: string): Promise<void> {
    await mkdir(path.dirname(zipPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(directory, false);
      archive.finalize().catch(reject);
    });
  }

  async uploadBuild(state: GenerationState, directory: string, zipPath: string): Promise<{ previewUrl: string; zipUrl: string; storagePrefix: string }> {
    if (workerConfig.siteStorageProvider === "local") {
      return this.localBuildResult(state);
    }

    try {
      return await this.uploadFirebaseBuild(state, directory, zipPath);
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        throw error;
      }

      console.warn(`Firebase Storage upload failed; serving local build instead. ${error instanceof Error ? error.message : String(error)}`);
      return this.localBuildResult(state);
    }
  }

  private localBuildResult(state: GenerationState): { previewUrl: string; zipUrl: string; storagePrefix: string } {
    const jobId = state.project.lastGenerationJobId ?? state.pages[0]?.jobId ?? state.project.id;
    const baseUrl = workerConfig.apiPublicUrl.replace(/\/$/, "");
    const previewPath = this.previewPathFor(state);
    const zipPath = state.zipPath ? path.relative(workerConfig.tmpRoot, state.zipPath).replace(/\\/g, "/") : `${jobId}.zip`;
    return {
      previewUrl: `${baseUrl}/api/local-builds/${encodeURIComponent(jobId)}/${previewPath.split("/").map(encodeURIComponent).join("/")}`,
      zipUrl: `${baseUrl}/api/local-builds/${zipPath.split("/").map(encodeURIComponent).join("/")}`,
      storagePrefix: `local-builds/${jobId}`
    };
  }

  private async uploadFirebaseBuild(state: GenerationState, directory: string, zipPath: string): Promise<{ previewUrl: string; zipUrl: string; storagePrefix: string }> {
    const bucket = storageBucket();
    const prefix = `users/${state.project.userId}/projects/${state.project.id}/jobs/${state.pages[0]?.jobId ?? "unknown"}`;
    const previewPath = this.previewPathFor(state);
    const zipFileName = path.basename(zipPath);

    for (const artifact of state.artifacts) {
      const localPath = path.join(directory, artifact.relativePath);
      const destination = `${prefix}/site/${artifact.relativePath}`;
      await bucket.upload(localPath, {
        destination,
        metadata: {
          contentType: artifact.contentType,
          cacheControl: "public, max-age=300"
        }
      });
    }

    await bucket.upload(zipPath, {
      destination: `${prefix}/${zipFileName}`,
      metadata: {
        contentType: "application/zip",
        cacheControl: "private, max-age=0"
      }
    });

    const [previewUrl] = await bucket.file(`${prefix}/site/${previewPath}`).getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7
    });
    const [zipUrl] = await bucket.file(`${prefix}/${zipFileName}`).getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7
    });

    return { previewUrl, zipUrl, storagePrefix: prefix };
  }

  private previewPathFor(state: GenerationState): string {
    return state.artifacts.find((artifact) =>
      artifact.contentType === "text/html" && artifact.relativePath.replace(/\\/g, "/").endsWith("/index.html")
    )?.relativePath.replace(/\\/g, "/") ?? "index.html";
  }
}
