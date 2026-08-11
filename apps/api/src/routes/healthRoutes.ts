import { Router } from "express";
import { getRuntimeCapabilityState } from "../services/capabilityService.js";

const router = Router();

router.get("/health", (_request, response) => {
  response.json({ ok: true });
});

router.get("/capabilities", async (_request, response, next) => {
  try {
    response.json(await getRuntimeCapabilityState());
  } catch (error) {
    next(error);
  }
});

export default router;
