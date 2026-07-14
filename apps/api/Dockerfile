# ═══════════════════════════════════════════════════════════
# M-CAP API Service - Production Dockerfile
# Build Context: Repository ROOT
# ═══════════════════════════════════════════════════════════

# ─── Stage 1: Base ─────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat wget

# ─── Stage 2: Dependencies ─────────────────────────────────
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Copy workspace package.json files (needed for npm workspaces)
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies
RUN npm ci

# ─── Stage 3: Builder ──────────────────────────────────────
FROM base AS builder

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy everything needed to build
COPY package.json package-lock.json* turbo.json ./
COPY tsconfig*.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build using turbo
RUN npx turbo run build --filter=@mcap/api

# Verify build output exists
RUN ls -la apps/api/dist/

# ─── Stage 4: Runner (Production) ──────────────────────────
FROM base AS runner

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

# Copy built API
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/package.json ./apps/api/

# Copy shared package
COPY --from=builder --chown=apiuser:nodejs /app/packages/shared ./packages/shared

# Copy migrations folder (IMPORTANT - migrate.ts needs this)
COPY --from=builder --chown=apiuser:nodejs /app/migrations ./migrations

# Copy root files & node_modules
COPY --from=builder --chown=apiuser:nodejs /app/package.json ./
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules

USER apiuser

# Railway will set PORT dynamically
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-4000}/health || exit 1

# Start API
CMD ["node", "apps/api/dist/index.js"]