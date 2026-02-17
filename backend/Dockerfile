# syntax=docker/dockerfile:1.4

# Stage 1: Base
# Use alpine for minimal footprint
FROM node:20-alpine AS base
WORKDIR /app
# Install OpenSSL (required for Prisma Client)
RUN apk add --no-cache openssl
ENV NODE_ENV=production

# Stage 2: Builder
# Install dependencies and build the application
FROM base AS builder
ENV NODE_ENV=development
# Install build tools for native modules (python3, make, g++)
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
# Prepare Prisma schema for production
RUN cp prisma/schema.production.prisma prisma/schema.prisma
# Generate Prisma Client
RUN npx prisma generate
# Build TypeScript
RUN npm run build

# Stage 3: Production
# Final image with only production dependencies and artifacts
FROM base AS production
# Copy package files
COPY package*.json ./
# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force
# Install Prisma CLI for migrations (start.sh uses it)
RUN npm install -g prisma@5 && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma
# Copy generated Prisma Client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Copy start script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Use non-root user for security
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["/app/start.sh"]