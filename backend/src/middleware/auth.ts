/**
 * Authentication and admin authorization middleware.
 *
 * Flow:
 *   POST /api/admin/login  → verifies password, returns a signed JWT
 *   requireAuth            → validates Bearer JWT on protected routes
 *   requireAdmin           → additionally checks the `role: "admin"` claim
 */

import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

// ── Config ─────────────────────────────────────────────────────────────────

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return secret;
}

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthPayload extends JwtPayload {
  role: "admin";
}

// Extend Express Request so downstream handlers can read `req.user`
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// ── Token helpers ──────────────────────────────────────────────────────────

/** Sign a JWT with role: "admin". */
export function signAdminToken(): string {
  return jwt.sign({ role: "admin" } as AuthPayload, jwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/** Verify and decode a JWT. Returns null if invalid or expired. */
export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, jwtSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────

/**
 * requireAuth — validates the `Authorization: Bearer <token>` header.
 * Sets `req.user` on success; responds 401 on failure.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = payload;
  next();
}

/**
 * requireAdmin — must be used after requireAuth.
 * Responds 403 if the token does not carry role: "admin".
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
