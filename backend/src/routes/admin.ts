/**
 * Admin routes — authentication and protected admin-only endpoints.
 *
 * Public:
 *   POST /api/admin/login        → exchange password for JWT
 *
 * Protected (require valid admin JWT):
 *   GET  /api/admin/health       → admin health check
 *   POST /api/admin/cache/clear  → clear the proposal cache
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { signAdminToken, requireAuth, requireAdmin } from "../middleware/auth";
import { invalidateProposalCache } from "../middleware/redisCache";

const router = Router();

// ── Login ──────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/login
 * Body: { password: string }
 * Returns: { token: string }
 *
 * Compares the supplied password against the bcrypt hash stored in
 * ADMIN_PASSWORD_HASH. The hash is generated with:
 *   node -e "const b=require('bcryptjs');console.log(b.hashSync('yourpass',10))"
 */
router.post("/admin/login", async (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(400).json({ error: "password is required" });
    return;
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.error("[auth] ADMIN_PASSWORD_HASH is not configured");
    res.status(500).json({ error: "Auth not configured" });
    return;
  }

  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signAdminToken();
  res.json({ token });
});

// ── Protected routes ───────────────────────────────────────────────────────

// All routes below require a valid admin JWT
router.use(requireAuth, requireAdmin);

/** GET /api/admin/health — confirms the caller holds a valid admin token */
router.get("/admin/health", (_req: Request, res: Response) => {
  res.json({ ok: true, role: "admin" });
});

/** POST /api/admin/cache/clear — invalidates the full proposal cache */
router.post("/admin/cache/clear", async (_req: Request, res: Response) => {
  await invalidateProposalCache();
  res.json({ ok: true, message: "Proposal cache cleared" });
});

export default router;
