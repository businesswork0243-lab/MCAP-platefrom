FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json turbo.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npx turbo run build --filter=@mcap/web

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "start"]
