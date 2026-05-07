FROM node:22-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1002 syntharena \
    && useradd --uid 1002 --gid 1002 --create-home syntharena \
    && chown syntharena:syntharena /app

FROM base AS deps
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
USER syntharena
COPY --chown=syntharena:syntharena package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
RUN pnpm rebuild better-sqlite3

FROM deps AS builder
COPY --chown=syntharena:syntharena . .
ENV DATABASE_URL="file:./dev.db"
RUN pnpm exec prisma generate
RUN pnpm run build

FROM deps AS migrate-runner
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/prod.db"
COPY --chown=syntharena:syntharena prisma.config.ts ./prisma.config.ts
COPY --chown=syntharena:syntharena prisma ./prisma
RUN mkdir -p /app/data
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/prod.db"

COPY --from=builder --chown=syntharena:syntharena /app/.next/standalone ./
COPY --from=builder --chown=syntharena:syntharena /app/.next/static ./.next/static
COPY --from=builder --chown=syntharena:syntharena /app/public ./public
COPY --from=deps --chown=syntharena:syntharena /app/node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node ./node_modules/.pnpm/better-sqlite3@11.10.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node
RUN mkdir -p /app/data && chown -R syntharena:syntharena /app/data
USER syntharena

EXPOSE 3000

CMD ["node", "server.js"]
