import { Router } from "express";
import type { StartGenerationRequest } from "@forgeseo/shared";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { ProjectService } from "../services/projectService.js";
import { startGenerationSchema } from "../validation.js";

const router = Router();
const service = new ProjectService();

router.get("/jobs/:jobId", requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = request.user?.uid;
    if (!userId) {
      response.status(401).json({ message: "Sign in to continue." });
      return;
    }

    const jobId = request.params.jobId;
    if (typeof jobId !== "string") {
      response.status(400).json({ message: "Generation job id is required." });
      return;
    }

    const job = await service.getGenerationJob(userId, jobId);
    response.json(job);
  } catch (error) {
    next(error);
  }
});

router.post("/start", requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const parsed = startGenerationSchema.parse(request.body) as StartGenerationRequest;
    const userId = request.user?.uid;
    if (!userId) {
      response.status(401).json({ message: "Sign in to continue." });
      return;
    }

    const result = await service.startGeneration(userId, parsed);
    response.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
