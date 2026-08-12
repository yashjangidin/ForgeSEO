import { Redis as IORedis } from "ioredis";
import { config, getCapabilityState, useLocalQueue } from "../config.js";

export const getRuntimeCapabilityState = async () => {
  const staticState = getCapabilityState();
  let redis = false;

  if (config.generationMode === "direct") {
    redis = true;
  } else if (useLocalQueue()) {
    redis = true;
  } else if (config.redisUrl) {
    const client = new IORedis(config.redisUrl, {
      connectTimeout: 1000,
      lazyConnect: true,
      maxRetriesPerRequest: 0
    });

    try {
      await client.connect();
      const pong = await client.ping();
      redis = pong === "PONG";
    } catch {
      redis = false;
    } finally {
      client.disconnect();
    }
  }

  const generationEnabled =
    staticState.firebaseAdmin && staticState.storage && staticState.structuredJson && redis;
  const missing = [
    staticState.firebaseAdmin ? undefined : "Firebase Admin credentials",
    staticState.storage ? undefined : "Storage provider",
    redis ? undefined : "Redis server or local queue",
    staticState.structuredJson ? undefined : "Structured JSON generator"
  ].filter((item): item is string => Boolean(item));

  return {
    ...staticState,
    redis,
    generationMode: config.generationMode,
    generationEnabled,
    disabledReason: generationEnabled
      ? undefined
      : `Generation is disabled until these integrations are configured: ${missing.join(", ")}.`,
    runtime: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_URL,
      environment: process.env.VERCEL_ENV ?? config.nodeEnv
    }
  };
};
