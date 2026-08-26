import { NextResponse } from "next/server";
import { ZodError, ZodIssue } from "zod";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from "@/lib/auth/session";

// ============================================================
// Standard API Response Helpers
// ============================================================

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Unified error handler for route handlers.
 * Maps custom error classes to appropriate HTTP status codes.
 */
export function handleApiError(error: unknown) {
  console.error("[API ERROR]", error);

  if (error instanceof ZodError) {
    return apiError(
      `Validation error: ${(error as ZodError).issues.map((e: ZodIssue) => e.message).join("; ")}`,
      400
    );
  }

  if (error instanceof BadRequestError) {
    return apiError(error.message, 400);
  }

  if (error instanceof UnauthorizedError) {
    return apiError(error.message, 401);
  }

  if (error instanceof ForbiddenError) {
    return apiError(error.message, 403);
  }

  if (error instanceof NotFoundError) {
    return apiError(error.message, 404);
  }

  return apiError("Internal server error", 500);
}
