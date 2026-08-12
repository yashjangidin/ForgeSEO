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
  user_id?: string;
  sub?: string;
}

const decodeLocalDevelopmentToken = (token: string): AuthenticatedRequest["user"] | undefined => {
  if (config.nodeEnv === "production") {
    return undefined;
  }

  const [, payload] = token.split(".");
  if (!payload) {
    return undefined;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalizedPayload, "base64").toString("utf8")) as DecodedTokenPayload;
    const uid = decoded.user_id ?? decoded.sub;
    if (!uid || (decoded.aud && config.firebase.projectId && decoded.aud !== config.firebase.projectId)) {
      return undefined;
    }
    return { uid, email: decoded.email };
  } catch {
    return undefined;
  }
};

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

    response.status(401).json({ message: "Your session could not be verified. Please sign in again." });
  }
};
