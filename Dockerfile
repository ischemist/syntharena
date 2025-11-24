# ===== BUILD STAGE =====
FROM node:22.16.0 AS builder

# Set environment variables for PNPM
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install pnpm
RUN npm install -g pnpm

# Set the working directory
WORKDIR /app

# Copy prisma schema and package files
COPY prisma ./prisma/
COPY package.json pnpm-lock.yaml ./

# Install dependencies with cache mounting
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm exec prisma generate

# Copy the rest of the application code
COPY . .

# Build the application
RUN pnpm run build

# ===== RUNTIME STAGE =====
FROM node:22.16.0-alpine

# Set environment variables for PNPM
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set the working directory
WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma/
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next/
COPY --from=builder --chown=nextjs:nodejs /app/public ./public/
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules/

# Switch to non-root user
USER nextjs

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
