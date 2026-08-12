import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import generationRoutes from "./routes/generationRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";

export const createApp = () => {
  const app = express();

  const allowedOrigins = new Set([config.webOrigin]);
  if (config.webOrigin.endsWith(".web.app")) {
    allowedOrigins.add(config.webOrigin.replace(/\.web\.app$/, ".firebaseapp.com"));
  }
  if (config.webOrigin.includes(".vercel.app")) {
    allowedOrigins.add(config.webOrigin);
  }

  const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) {
      return true;
    }
    if (allowedOrigins.has(origin)) {
      return true;
    }
    if (config.nodeEnv !== "production") {
      return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
    }
    return false;
  };

  app.use(cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin) ? origin ?? true : false);
    },
    credentials: true
  }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_request, response) => {
    response.json({
      name: "ForgeSEO API",
      ok: true,
      endpoints: {
        health: "/api/health",
        capabilities: "/api/capabilities",
        templates: "/api/templates"
      }
    });
  });

  app.get("/api", (_request, response) => {
    response.json({
      name: "ForgeSEO API",
      ok: true,
      endpoints: {
        health: "/api/health",
        capabilities: "/api/capabilities",
        templates: "/api/templates"
      }
    });
  });

  app.use("/api", healthRoutes);
  app.use("/api/generation", generationRoutes);
  app.use("/api/local-builds", express.static(config.localBuildRoot));
  app.use("/api/templates", templateRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
