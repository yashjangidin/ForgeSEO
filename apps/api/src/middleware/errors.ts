import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class PublicError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export const notFound = (_request: Request, response: Response): void => {
  response.status(404).json({ message: "The requested resource was not found." });
};

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  if (error instanceof PublicError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      message: "Please review the highlighted fields.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Something went wrong while processing your request." });
};

