# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **monorepo** containing multiple interrelated Inopay apps. It is not a standard single-app layout — understand which sub-tree you're editing before changing anything.

| Path | Role | Language/Runtime | Entry | Install with |
|---|---|---|---|---|
| `src/` | Main **Liberator** frontend (this is what `npm run dev`/`build` compiles) | React 18 + Vite + TS, Tailwind, shadcn/ui | `src/main.tsx` → `App.tsx` | root `package.json` |
| `backend/` | Autonomous Express/TS backend for Liberator (Stripe, liberate, clean-code, deploy) | Node ≥18, Express, tsx | `backend/src/index.ts` | `cd backend && npm install` |
| `api/` | **Separate** Express API (JS, CommonJS) for `getinopay.com` services — CinetPay payments, SGI, auth, functions | Node, Express | `api/src/index.js` | `cd api && npm install` |
| `app/` | **Separate** React frontend for the Fofy/SGI/investor product (not the Liberator UI) | React + TS | `app/src/` | not built from root |
| `cli/` | `@inopay/cli` npm package (`inopay liberate|audit|scan`) | Node, commander, ESM, tsx | `cli/src/index.ts` | `cd cli && npm install` |
| `supabase/functions/` | ~94 Supabase Edge Functions (Deno) used by the Liberator | Deno | per-function `index.ts` | `supabase functions deploy` |
| `supabase/migrations/` | 38 timestamped Postgres migrations with RLS | SQL | — | `supabase db push` |

The root `package.json` is the Liberator frontend. The `backend/`, `api/`, `app/`, and `cli/` packages have their own `package.json` and must be installed/built independently.

## Common commands

**Root (Liberator frontend):**
```bash
npm install --legacy-peer-deps    # peer-deps mismatch; --legacy-peer-deps is required (also used in Dockerfile and CI)
npm run dev                       # Vite dev server on port 8080
npm run build                     # standard Vite build
npm run build:dev                 # development-mode build
npm run lint                      # ESLint (flat config, see eslint.config.js)
npx vite build --config vite.config.sovereign.ts   # production/sovereign build (Terser, PWA, manual chunks, no sourcemaps)
```

**Sovereignty audit (pre-build gate):**
```bash
node scripts/sovereignty-audit.js --min-score=90    # blocks build if proprietary patterns detected (lovable-tagger, @lovable/*, @bolt/*, @v0/*, etc.). Dockerfile runs this before `vite build`.
```

**Backend (`backend/`):**
```bash
npm run dev        # tsx watch src/index.ts, listens on PORT (default 3001)
npm run build      # tsc → dist/
npm start          # node dist/index.js
npm run lint
```

**Legacy API (`api/`):** plain `node src/index.js` with Express + express-rate-limit. Allowed origins are hardcoded to `getinopay.com` + localhost.

**CLI (`cli/`):**
```bash
npm run dev                              # tsx src/index.ts
npm run liberate <project-path>
npm run audit <project-path>
npm run build                            # tsc; publishable as @inopay/cli
```

**Tests:** there is no configured test runner in any `package.json`. A single test file exists at `src/lib/__tests__/aiReplacements.test.ts` but no `test` script — treat tests as effectively absent; do not invent `npm test`.

**Mobile (Capacitor):** `capacitor.config.json` points to `dist/` with `appId: com.inopay.app`. Android AAB is built by `.github/workflows/build-mobile.yml`; locally: `npx cap add android && npx cap sync android` after a web build.

## Architecture — key things that aren't obvious from a file tree

### "Liberation" pipeline (the core domain)

The Liberator takes a user's proprietary codebase (Lovable, Bolt, v0, GPT Engineer…) and produces a sovereign, self-hostable version. The pipeline has four phases orchestrated by `src/lib/unifiedLiberator.ts`:

1. **Scan** — `src/lib/lovablePatternScanner.ts` detects proprietary imports, telemetry domains, exposed secrets, platform fingerprints.
2. **Clean** — `src/lib/lovableCleanerEngine.ts` + `clientProprietaryPatterns.ts` (`deepCleanSourceFile`) strip proprietary code and substitute open-source equivalents.
3. **Refactor** — `src/lib/astRefactor.ts` does AST-level rewrites.
4. **Rebuild** — `src/lib/projectRebuilder.ts` emits a new project with Docker configs, deploy guides, RLS policies, etc.

When modifying any of these, the other three usually need to stay in sync — they share types and a single `LiberationResult`. `liberatorCore.ts` is an older/parallel engine; prefer `unifiedLiberator.ts` as the orchestrator.

### Infrastructure abstraction (cloud ↔ self-hosted)

`src/infrastructure/adapter.ts` (exported via `src/infrastructure/index.ts`) is the **single abstraction point** for all external services. The mode is controlled by `VITE_INFRA_MODE` (`cloud` | `self-hosted` | `hybrid`). Provider enums cover storage (Supabase / MinIO / S3), auth (Supabase / PocketBase / custom), AI (Ollama / LM Studio / OpenWebUI / none — **no proprietary AI providers**), email, realtime, search. New external integrations should route through this adapter, not directly import SDKs from components.

### Backend request handling (`backend/src/index.ts`)

- `trust proxy` is `1` — assume a reverse proxy in front.
- CSP is strict (`connectSrc` hard-codes `izqveyvcebolrqpqlmho.supabase.co`); update it when the Supabase project changes.
- `/api/stripe-webhook` bypasses `express.json` parsing (Stripe requires the raw body) — don't regress this.
- Per-endpoint rate limiters (`aiLimiter`, `paymentLimiter`, `deployLimiter`) live in `backend/src/middleware/rateLimiter.ts`; `sanitizeInputs` and `injectionProtection` in `inputValidator.ts` run globally.

### Supabase Edge Functions

~94 Deno functions under `supabase/functions/`. Shared code lives in `supabase/functions/_shared/`. Many backend routes (`check-subscription`, `create-checkout`, `clean-code`, `liberate`, `deploy-*`) exist as both Express routes in `backend/` *and* Edge Functions — they are intentional alternatives (self-hosted vs cloud), not duplicates. If you change contract/behavior, update both.

### Frontend routing (`src/App.tsx`)

Two route surfaces: the public site (`/`, `/tarifs`, `/auth`, `/dashboard`, …, French paths) and the Liberator workflow (`/liberator/*` wrapped in `LiberatorLayout`). Path alias `@` → `./src` is configured in both Vite configs and `tsconfig.app.json`.

### Build target matters

- `vite.config.ts` — dev/default. Includes `lovable-tagger` only in development mode.
- `vite.config.sovereign.ts` — production/self-hosted exports. Terser drops `console.*`, mangles `_private_` properties, uses manual chunk splitting (`vendor-react`, `vendor-ui`, `vendor-motion`, `vendor-charts`, `vendor-supabase`), disables sourcemaps, adds vite-plugin-pwa. **The Dockerfile and any "sovereign export" path uses this config** — not the default.

### Sovereignty is enforced, not just documented

`scripts/sovereignty-audit.js` is a blocking CI/build gate. Scores < 80 → build blocked; 80–94 → warnings. Adding anything that looks like `data-lovable-id`, `lovable-tagger` (outside the dev-only path), `@bolt/*`, `@v0/*`, `@gptengineer/*` will fail audits. The `lovable-tagger` dep in root `package.json` is *intentionally* gated to `mode === 'development'` in `vite.config.ts` — don't unconditionally import it.

## Notes / gotchas

- Root install requires `--legacy-peer-deps` (see Dockerfile, `build-mobile.yml`).
- User-facing strings and most comments are in **French**. Preserve the language when editing existing files.
- The repo contains both a `.env` (present, non-empty, 161 bytes) and `.env.example`. Don't commit secrets; `.env.example` is the canonical template.
- `README.md`, `INSTALL.md`, `INSTALLATION-COOLIFY.md`, `MIGRATION_GUIDE.md`, `STABILITY_REPORT.md`, and `docs/*.md` are existing user-facing docs — extend rather than duplicate them.
