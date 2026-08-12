let cachedApp;

export default async function handler(request, response) {
  const path = request.url?.split("?")[0] ?? "/";

  if (path === "/" || path === "/api" || path === "/api/health") {
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
