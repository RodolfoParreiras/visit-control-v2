# ── Stage 1: Build do Frontend ───────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /app

# Copia manifests para cache de camadas
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig*.json ./
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/frontend/package.json ./apps/frontend/

RUN pnpm install --frozen-lockfile

COPY packages/api-client ./packages/api-client
COPY apps/frontend ./apps/frontend

WORKDIR /app/apps/frontend
RUN pnpm run build

# ── Stage 2: Nginx com frontend compilado ────────────────────────────────────
FROM nginx:alpine AS runtime

# Remove configuração padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos do frontend
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copia as configurações do nginx
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
