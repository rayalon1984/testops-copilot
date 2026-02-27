# Migration Guide: v3.0.0 → v3.0.1

> **v3.0.1 renames TestOps Companion → TestOps Copilot.** This guide covers what existing users need to do.

---

## Who Needs This Guide?

If you're running **v3.0.0 or earlier** and upgrading to v3.0.1, read below. If this is a fresh install, skip this guide entirely.

---

## 1. JWT Tokens (Re-login Required)

**What changed**: JWT issuer/audience values changed from `testops-companion` / `testops-companion-client` to `testops-copilot` / `testops-copilot-client`.

**Impact**: All existing JWT tokens become invalid after upgrade.

**Action**: All users must **re-login** after the upgrade. This happens automatically — expired/invalid tokens redirect to the login page.

**No data loss** — user accounts, pipelines, test runs, and all stored data are unaffected.

---

## 2. Encrypted AI Provider Config (Automatic Fallback)

**What changed**: The default encryption salt for AI provider API keys stored in the database changed from `testops-companion-default-enc-key` to `testops-copilot-default-enc-key`.

**Impact**: If you were using the **default encryption key** (no `AI_CONFIG_ENCRYPTION_KEY` env var set), your stored provider configs are encrypted with the old key.

**Action**: **None required.** The code automatically tries the new key first, then falls back to the legacy key for existing data. New encryptions use the new key. You'll see a one-time info log: `[ProviderConfig] Decrypting with legacy key (pre-v3.0.1 data)`.

**If you set `AI_CONFIG_ENCRYPTION_KEY`**: No impact at all — your custom key is unchanged.

---

## 3. Package Names

**What changed**: npm package names changed:
- `testops-companion` → `testops-copilot`
- `testops-companion-backend` → `testops-copilot-backend`
- `testops-companion-frontend` → `testops-copilot-frontend`
- `@testops-companion/mcp-server` → `@testops-copilot/mcp-server`

**Impact**: If you reference these packages by name in scripts, Docker builds, or CI configs, update the references.

**Action**: After `git pull`, run `npm install` to regenerate `node_modules` and `package-lock.json`.

---

## 4. Nginx / SSL (Production Deployments)

**What changed**: `infra/nginx/prod.conf` now references `testops-copilot.com` and SSL cert paths `testops-copilot.crt`/`testops-copilot.key`.

**Impact**: If you use the bundled nginx config, update your DNS and SSL certificates to match.

**Action**: Either:
- Rename your SSL certs to `testops-copilot.crt` / `testops-copilot.key`
- Or keep your existing config and skip pulling `infra/nginx/prod.conf`

---

## 5. OpenTelemetry Service Name

**What changed**: Default OTEL service name changed from `testops-companion-backend` to `testops-copilot-backend`.

**Impact**: If you query traces/metrics by service name, update your Grafana/Prometheus dashboards.

**Action**: Set `OTEL_SERVICE_NAME=testops-copilot-backend` in your environment, or keep the old value if you prefer continuity.

---

## Quick Checklist

```bash
# 1. Pull latest code
git pull origin main

# 2. Reinstall dependencies (package names changed)
npm install

# 3. Restart backend
npm run start    # or: docker compose up -d

# 4. All users re-login (JWT tokens invalidated)
# → Automatic: invalid tokens redirect to /login

# 5. Verify
curl http://localhost:3000/api/health
```

That's it. The upgrade is designed to be seamless — the only user-visible change is a one-time re-login.

---

*Last updated: 2026-02-26*
