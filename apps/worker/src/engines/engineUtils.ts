import crypto from "node:crypto";

export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

export const countWords = (input: string): number =>
  input.trim().split(/\s+/).filter(Boolean).length;

export const pageId = (projectId: string, jobId: string, slug: string): string =>
  crypto.createHash("sha256").update(`${projectId}:${jobId}:${slug}`).digest("hex").slice(0, 24);
