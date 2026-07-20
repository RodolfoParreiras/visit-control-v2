# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copia manifests para cache de camadas
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig*.json ./
COPY packages/db/package.json     ./packages/db/
COPY packages/api-zod/package.json ./packages/api-zod/
COPY apps/backend/package.json    ./apps/backend/

RUN pnpm install --frozen-lockfile

# Copia código-fonte
COPY packages/db     ./packages/db
COPY packages/api-zod ./packages/api-zod
COPY apps/backend    ./apps/backend

WORKDIR /app/apps/backend
RUN pnpm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Copia os artefatos compilados e dependências de runtime
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/node_modules      ./node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "--enable-source-maps", "/app/dist/index.mjs"]
