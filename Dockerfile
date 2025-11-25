FROM node:22-bookworm

WORKDIR /app

# install pnpm
RUN npm install -g pnpm

# copy package files
COPY package.json pnpm-lock.yaml ./

# install ALL dependencies (including devDependencies like typescript/prisma)
# this ensures prisma.config.ts can actually be read
RUN pnpm install --frozen-lockfile

# copy source
COPY . .

# rebuild sqlite bindings for this container's os
RUN pnpm rebuild better-sqlite3

# dummy env vars for build
ENV DATABASE_URL="file:./dev.db"

# generate client and build nextjs
RUN pnpm exec prisma generate
RUN pnpm run build

# expose port
EXPOSE 3000

# migrate real db, then start
# using 'pnpm start' because we have the full environment now
CMD npx prisma migrate deploy && pnpm start
