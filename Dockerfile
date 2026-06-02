# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────
# Auren Care · Dockerfile multi-stage
#
# Stages:
#   deps     — instala TODAS as deps (com cache + build tools p/ bcrypt)
#   builder  — roda `next build` em modo standalone
#   migrator — imagem auxiliar com tsx + migrations + service code
#   runner   — imagem final mínima (Alpine, non-root, ~200MB)
#
# Build:
#   docker build -t aurencare:latest .
#
# Run:
#   docker run --rm -p 3000:3000 \
#     --env-file .env.local \
#     aurencare:latest
#
# Rodar migrations:
#   docker run --rm --env-file .env.local \
#     aurencare:latest npm run migrate
# ──────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20-alpine

# ─── deps ────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# build tools pro bcrypt compilar (.node bindings) + libc6-compat pro Next.js
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# ─── builder ─────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# placeholder de env vars que o Next exige no build (NextAuth, etc.)
# Os valores REAIS vêm em runtime via --env-file.
ENV NEXTAUTH_SECRET=__build_placeholder__
ENV NEXTAUTH_URL=http://localhost:3000
ENV DATABASE_URL=postgresql://placeholder@placeholder:5432/placeholder
ENV ENCRYPTION_KEY=__build_placeholder_64_caracteres__

RUN npm run build

# ─── runner (imagem final) ───────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat curl dumb-init

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário não-root pro runtime
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs auren

# Output standalone do Next contém apenas o server + deps necessárias
COPY --from=builder --chown=auren:nodejs /app/.next/standalone ./
COPY --from=builder --chown=auren:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=auren:nodejs /app/public ./public

# Migrations + tsx + service code pra `npm run migrate` rodar dentro do container.
# Mantém o caminho relativo que o script `migrate` espera (src/server/db/migrate.ts).
COPY --from=builder --chown=auren:nodejs /app/src/server/db ./src/server/db
COPY --from=builder --chown=auren:nodejs /app/package.json ./package.json
# tsx binário + suas deps; cobrir só isso evita arrastar todo node_modules.
COPY --from=builder --chown=auren:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder --chown=auren:nodejs /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder --chown=auren:nodejs /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=builder --chown=auren:nodejs /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=builder --chown=auren:nodejs /app/node_modules/pg ./node_modules/pg
COPY --from=builder --chown=auren:nodejs /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder --chown=auren:nodejs /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder --chown=auren:nodejs /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder --chown=auren:nodejs /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=builder --chown=auren:nodejs /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=builder --chown=auren:nodejs /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

USER auren

EXPOSE 3000

# Healthcheck — bate na home (redirect 307 pra login conta como saudável).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -qE "^(200|307|302)$" || exit 1

# dumb-init lida com sinais (SIGTERM grupo) — evita zumbis em K8s/ECS
ENTRYPOINT ["dumb-init", "--"]

# server.js é gerado pelo build standalone do Next.
CMD ["node", "server.js"]
