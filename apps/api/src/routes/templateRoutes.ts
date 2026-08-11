import { Router } from "express";
import { TemplateService } from "../services/templateService.js";

const router = Router();
const service = new TemplateService();

router.get("/", async (_request, response, next) => {
  try {
    response.json(await service.listTemplates());
  } catch (error) {
    next(error);
  }
});

router.get("/:templateId/preview", async (request, response, next) => {
  try {
    const templateId = request.params.templateId;
    if (!templateId) {
      response.status(400).json({ message: "Template id is required." });
      return;
    }
    const preview = await service.loadPreview(templateId);
    if (!preview) {
      response.status(404).json({ message: "Template preview was not found." });
      return;
    }
    response.type(preview.contentType).send(preview.content);
  } catch (error) {
    next(error);
  }
});

export default router;
