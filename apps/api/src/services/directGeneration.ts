import { GenerationPipeline } from "@forgeseo/worker/pipeline/generationPipeline";
import type { GenerationQueuePayload } from "./jobQueue.js";

const pipeline = new GenerationPipeline();

export const runDirectGeneration = async (payload: GenerationQueuePayload): Promise<void> => {
  await pipeline.run(payload);
};
