// ============================================================
// Session Helper — Placeholder for real auth
// Replace with your actual session/auth provider.
// ============================================================

export interface Session {
  user_id: string;
  role: "admin" | "staff" | "visitor";
  email: string;
}

/**
 * Mock session helper.
 * In production, this would read from cookies/JWT/session store.
 * Assumes a getSession() helper exists per the requirements.
 */
export async function getSession(): Promise<Session | null> {
  // TODO: Replace with real auth (e.g., next-auth, Lucia, custom JWT)
  // For now, return a mock admin session for development
  return {
    user_id: "dev-admin-001",
    role: "admin",
    email: "admin@example.com",
  };
}

/**
 * Helper to enforce admin-only access.
 * Call this at the top of admin-only route handlers.
 * Returns the session if valid, or throws a NextResponse error.
 */
export async function requireAdmin() {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError("Authentication required");
  }

  if (session.role !== "admin") {
    throw new ForbiddenError("Admin access required");
  }

  return session;
}

// ============================================================
// Custom error classes for route handlers
// ============================================================

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends Error {
  constructor(message = "Bad request") {
    super(message);
    this.name = "BadRequestError";
  }
}
