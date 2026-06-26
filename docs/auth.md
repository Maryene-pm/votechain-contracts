# Backend Authentication & Admin Authorization

> Resolves [#463](https://github.com/Vera3289/votechain-contracts/issues/463)

## Overview

Admin-only backend endpoints are protected with **JWT Bearer authentication**.  
A password-based login endpoint issues a signed token. Every subsequent admin request must include that token.

```
POST /api/admin/login          (public — exchange password for token)
GET  /api/admin/health         (protected — admin only)
POST /api/admin/cache/clear    (protected — admin only)
```

Non-admin callers receive:
- `401 Unauthorized` — missing, malformed, or expired token
- `403 Forbidden` — valid token but insufficient role

---

## Configuration

Copy `.env.example` to `.env` and set the following variables:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | Random secret ≥ 32 chars for signing JWTs |
| `JWT_EXPIRES_IN` | optional | Token TTL in [zeit/ms](https://github.com/vercel/ms) format (default: `8h`) |
| `ADMIN_PASSWORD_HASH` | ✅ | bcrypt hash of the admin password (cost factor 10) |

### Generate a password hash

```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('yourpassword', 10))"
```

Paste the output as `ADMIN_PASSWORD_HASH` in your `.env`.

### CI environments

Set `JWT_SECRET` and `ADMIN_PASSWORD_HASH` as repository secrets (GitHub: **Settings → Secrets and variables → Actions**). The backend reads them from the environment at startup; no file changes are needed.

---

## Authentication Flow

```
Client                          Server
  │                                │
  │  POST /api/admin/login         │
  │  { "password": "..." }  ──────►│
  │                                │  bcrypt.compare(password, ADMIN_PASSWORD_HASH)
  │◄──────────────────────────────  │
  │  { "token": "<JWT>" }          │
  │                                │
  │  GET /api/admin/health         │
  │  Authorization: Bearer <JWT> ─►│
  │                                │  jwt.verify → role === "admin"
  │◄──────────────────────────────  │
  │  200 { "ok": true }            │
```

---

## API Reference

### POST `/api/admin/login`

Exchange the admin password for a JWT.

**Request**
```json
{ "password": "your-admin-password" }
```

**Response `200`**
```json
{ "token": "eyJhbGci..." }
```

**Errors**
| Status | Body | Reason |
|--------|------|--------|
| `400` | `{ "error": "password is required" }` | Body missing `password` field |
| `401` | `{ "error": "Invalid credentials" }` | Wrong password |
| `500` | `{ "error": "Auth not configured" }` | `ADMIN_PASSWORD_HASH` not set |

---

### GET `/api/admin/health`

Confirms the caller holds a valid admin token.

**Headers** `Authorization: Bearer <token>`

**Response `200`**
```json
{ "ok": true, "role": "admin" }
```

---

### POST `/api/admin/cache/clear`

Clears the full proposal Redis cache.

**Headers** `Authorization: Bearer <token>`

**Response `200`**
```json
{ "ok": true, "message": "Proposal cache cleared" }
```

---

## Middleware

### `requireAuth`

Validates the `Authorization: Bearer <token>` header. Sets `req.user` on success.

```typescript
import { requireAuth } from "../middleware/auth";

router.get("/my-route", requireAuth, handler);
```

### `requireAdmin`

Must be applied **after** `requireAuth`. Rejects requests where the token does not carry `role: "admin"`.

```typescript
import { requireAuth, requireAdmin } from "../middleware/auth";

router.post("/admin-only", requireAuth, requireAdmin, handler);
```

---

## Adding a New Protected Endpoint

```typescript
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.post("/admin/my-action", requireAuth, requireAdmin, async (req, res) => {
  // Only reachable with a valid admin JWT
  res.json({ ok: true });
});

export default router;
```

Register it in `src/app.ts`:
```typescript
import myAdminRoutes from "./routes/my-admin";
app.use("/api", myAdminRoutes);
```
