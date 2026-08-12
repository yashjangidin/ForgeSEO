let cachedApp;

export default async function handler(request, response) {
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
      stack: process.env.NODE_ENV === "production" ? undefined : stack
    });
  }
}
