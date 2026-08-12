import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { getAuth } from "../services/firebaseAdmin.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

interface DecodedTokenPayload {
  aud?: string;
  email?: string;
  iss?: string;
  user_id?: string;
  sub?: string;
}

const decodeTokenPayload = (token: string): DecodedTokenPayload | undefined => {
  const [, payload] = token.split(".");
  if (!payload) {
    return undefined;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(normalizedPayload, "base64").toString("utf8")) as DecodedTokenPayload;
  } catch {
    return undefined;
  }
};

const decodeLocalDevelopmentToken = (token: string): AuthenticatedRequest["user"] | undefined => {
  if (config.nodeEnv === "production") {
    return undefined;
  }

  const decoded = decodeTokenPayload(token);
  const uid = decoded?.user_id ?? decoded?.sub;
  if (!uid || (decoded?.aud && config.firebase.projectId && decoded.aud !== config.firebase.projectId)) {
    return undefined;
  }
  return { uid, email: decoded?.email };
};

const getAuthErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

const getAuthErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const requireAuth = async (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
): Promise<void> => {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    response.status(401).json({ message: "Sign in to continue." });
    return;
  }

  try {
    const auth = await getAuth();
    const decoded = await auth.verifyIdToken(token);
    request.user = {
      uid: decoded.uid,
      email: decoded.email
    };
    next();
  } catch (error) {
    const localUser = decodeLocalDevelopmentToken(token);
    if (localUser) {
      console.warn("Firebase Admin token verification failed; using local development token fallback.", error instanceof Error ? error.message : error);
      request.user = localUser;
      next();
      return;
    }

    const decoded = decodeTokenPayload(token);
    const code = getAuthErrorCode(error) ?? "firebase-auth/verify-id-token-failed";
    const detail = getAuthErrorMessage(error);
    console.warn("Firebase Admin token verification failed.", {
      code,
      detail,
      expectedProjectId: config.firebase.projectId,
      tokenAudience: decoded?.aud,
      tokenIssuer: decoded?.iss
    });

    response.status(401).json({
      message: "Your session could not be verified. Please sign in again.",
      error: {
        code,
        detail,
        expectedProjectId: config.firebase.projectId,
        tokenAudience: decoded?.aud,
        tokenIssuer: decoded?.iss
      }
    });
  }
};
