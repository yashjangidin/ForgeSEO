let cachedApp;

const present = (value) => typeof value === "string" && value.trim().length > 0;

const directCapabilities = () => {
  const generationMode = process.env.GENERATION_MODE === "direct" ? "direct" : "queue";
  const firebaseAdmin = Boolean(
    present(process.env.FIREBASE_PROJECT_ID) &&
      (present(process.env.FIREBASE_CLIENT_EMAIL) || process.env.NODE_ENV === "production") &&
      (present(process.env.FIREBASE_PRIVATE_KEY) || process.env.NODE_ENV === "production")
  );
  const storage = process.env.SITE_STORAGE_PROVIDER === "local" || Boolean(firebaseAdmin && present(process.env.FIREBASE_STORAGE_BUCKET));
  const redis = generationMode === "direct" || present(process.env.REDIS_URL);
  const structuredJson = process.env.STRUCTURED_JSON_PROVIDER !== "deterministic" || present(process.env.OPENAI_API_KEY);
  const generationEnabled = firebaseAdmin && storage && redis && structuredJson;
  const missing = [
    firebaseAdmin ? undefined : "Firebase Admin credentials",
    storage ? undefined : "Storage provider",
    redis ? undefined : "Redis URL or direct generation mode",
    structuredJson ? undefined : "Structured JSON generator"
  ].filter(Boolean);

  return {
    firebaseAdmin,
    redis,
    generationMode,
    structuredJson,
    openai: process.env.STRUCTURED_JSON_PROVIDER !== "deterministic" || present(process.env.OPENAI_API_KEY),
    storage,
    generationEnabled,
    disabledReason: generationEnabled
      ? undefined
      : `Generation is disabled until these integrations are configured: ${missing.join(", ")}.`
  };
};

export default async function handler(request, response) {
  const path = request.url?.split("?")[0] ?? "/";

  if (path === "/" || path === "/api") {
    response.status(200).json({
      name: "ForgeSEO API",
      ok: true,
      endpoints: {
        health: "/api/health",
        capabilities: "/api/capabilities",
        templates: "/api/templates"
      }
    });
    return;
  }

  if (path === "/api/health") {
    response.status(200).json({ ok: true });
    return;
  }

  if (path === "/api/capabilities") {
    response.status(200).json(directCapabilities());
    return;
  }

  try {
    if (!cachedApp) {
      const module = await import("../apps/api/dist/app.js");
      cachedApp = module.app;
    }
    return cachedApp(request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("ForgeSEO API boot failed", error);
    response.status(500).json({
      message: "ForgeSEO API boot failed.",
      error: message,
      stack
    });
  }
}
