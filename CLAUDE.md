# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Visitor-control system for public offices ("Sistema de Controle de Visitantes"): registers visitor entry/exit, prints ID labels, reports, audit log, and a service-queue "Central de Atendimento" with a live call display. UI text, comments, and commit messages are in Brazilian Portuguese — keep that convention.

pnpm monorepo (`pnpm@10`, enforced by `scripts/ensure-pnpm.cjs` in `preinstall`; npm/yarn will fail). Shared dependency versions live in the `catalog:` section of `pnpm-workspace.yaml`.

## Commands

```bash
pnpm install
pnpm dev:backend                 # Express API on :3001 (tsx watch); needs DATABASE_URL + SESSION_SECRET in .env
PORT=3000 pnpm dev:frontend      # Vite on :3000, proxies /api -> localhost:3001 (override with VITE_API_URL)
pnpm dev:desktop                 # Electron shell
pnpm typecheck                   # tsc --build for packages/*, then per-app tsc --noEmit
pnpm build                       # typecheck + build every workspace
pnpm test                        # backend unit tests (node:test via tsx)
pnpm --filter @visit-control/api-spec run codegen   # regenerate api-client + api-zod from openapi.yaml
docker compose up -d db          # local Postgres only
```

Run a single test file: `pnpm --filter @visit-control/backend exec tsx --test src/lib/cpf.test.ts`. Note the backend `test` script lists test files explicitly — add new `*.test.ts` files to it in `apps/backend/package.json`.

There is no linter configured; Prettier is available at the root.

Production/Docker startup is `scripts/start.sh` (or `start.ps1` / `start.cmd` on Windows), which builds the compose stack (db, backend, nginx) and interactively prompts for the first admin user.

## Architecture

- **`packages/db`** — Drizzle schema (`src/schema/*`) and the shared `pg` pool/`db` instance. Importing it throws if `DATABASE_URL` is unset. Schema evolution in production is **not** drizzle-kit migrations: `src/migrations.ts` holds an ordered list of hand-written idempotent SQL migrations tracked in a `schema_migrations` table, executed by `runMigrations()` on backend startup. Add schema changes both to the Drizzle schema and as a new entry at the end of that list.
- **`packages/api-spec`** — `openapi.yaml` is the source of truth for most endpoints. Orval generates `packages/api-client/src/generated` (React Query hooks using the `custom-fetch.ts` mutator) and `packages/api-zod/src/generated` (Zod schemas used by backend `validate` middleware). Never hand-edit `generated/`; edit the spec and run codegen. Failed requests throw `ApiError`, whose parsed JSON body is `error.data` (not `error.response.data`).
- **`apps/backend`** — Express 5. `src/index.ts` runs migrations, then `seedAdminUser()` (interactive first-admin prompt, see `lib/initial-admin.ts` / `setup-admin.ts`), then listens. Routers in `src/routes/` are mounted under `/api` via `routes/index.ts`. Auth is JWT (`Authorization: Bearer`) via `middlewares/auth.ts`. Access is controlled by **per-user permissions** (`permissionKeys` in `packages/db/src/schema/users.ts`, stored as JSONB on `users.permissions`), checked with `requirePermission(...)` (any-of) or `hasPermission()` from `lib/permissions.ts`. The role (`admin`/`receptionist`/`attendant`) only labels the user and suggests default permissions; `admin` always has every permission, and user management and backup stay `requireAdmin`. A non-admin user's `sectorId` is also a **data scope** (`sectorScope()` in `lib/permissions.ts`): visits, visitors (only people who visited the sector), sectors, dashboard, reports and the call display are filtered to that sector, and out-of-scope records answer 404. Exception: users with `registerVisit` can search/open any visitor so they can register a first visit to their sector. Any new query over visits must apply the scope. The call display (`/call-display`, `GET /api/service/display`) requires login plus `viewCallDisplay`; only the SSE stream stays public because it carries no names. The frontend mirrors this in `apps/frontend/src/lib/permissions.ts` (`can`, `homePath`, `<PrivateRoute permission=...>`) — keep both lists in sync with the `UserPermissions` schema in the OpenAPI spec. Mutations record audit entries with `auditAction()` from `lib/audit.ts`. Built with esbuild (`build.mjs`) into `dist/index.mjs`.
- **Service queue (Central de Atendimento)** — `routes/service.ts` is *not* in the OpenAPI spec; the frontend calls it through the hand-written `apps/frontend/src/lib/service-api.ts`. Real-time updates to the call display/attendants use Server-Sent Events from `lib/service-events.ts` (`/api/service/display/events`, excluded from rate limiting). On the client, never use a raw `EventSource`: `apps/frontend/src/lib/realtime.ts` (`useServiceEvents`) reconnects after HTTP errors (native EventSource gives up on a 502), detects silent dead connections via the server's `ping` event every 20 s, and fires `onResync` after reconnecting. It is mounted once in `contexts/RealtimeProvider.tsx`, which invalidates only queue-dependent queries. Diagnostics: `localStorage.setItem('realtime-debug','1')` logs connection state to the console. The global rate limiter is keyed per authenticated user (in Docker Desktop every client reaches nginx from the same gateway IP), and the login limiter per IP + login. New visits to a queue-enabled sector are enqueued with visit status `waiting` and become `ongoing` when called; `service_queue.priority_level` (0 normal, 1 priority, 2 for 80+) is computed at entry by `lib/priority.ts` from the visitor's birth date plus an optional manual reason, and the attendant explicitly chooses the priority or normal queue when calling. Treat both `waiting` and `ongoing` as "open" visits. Visitors created before birth dates existed have `birth_date` NULL; `POST /visits` rejects them with code `VISITOR_BIRTH_DATE_REQUIRED` until the date is supplied.
- **Visit snapshots** — visits store a copy of visitor data (`visitor_name`, `visitor_cpf`, …) at creation time (`lib/visitor-snapshot.ts`) so historical records don't change when the visitor is edited. Visitor CPF is required and unique (`lib/cpf.ts` validates; mirrored in `apps/frontend/src/lib/cpf.ts`).
- **`apps/frontend`** — React 19 + Vite + Tailwind v4 + shadcn/ui (`components/ui`), routing with `wouter`, `@/` alias → `src/`. Auth state in `contexts/AuthContext.tsx` (token in `localStorage` key `auth_token`). Pages in `src/pages/`. PDF/XLSX export via jspdf/xlsx; label printing in `lib/print-label.ts`.
- **`apps/desktop`** — thin Electron wrapper (`src/main.cjs`, CommonJS) that loads a configurable server URL (persisted in a JSON config file in userData) and shows `offline.html` when unreachable. Built for Windows NSIS with `electron-builder`; the many `release-*` directories are past build outputs.
- **Deployment** — Nginx (`nginx/`, `docker/nginx.Dockerfile`) serves the built SPA and proxies `/api/*` to the backend container. Backup/restore via `scripts/backup.sh` / `restore.sh` and an admin-only in-app backup route (`routes/backup.ts`).
