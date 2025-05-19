# syntax=docker/dockerfile:1.4

# Base stage for both development and production
FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Development stage
FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Dependencies stage for production
FROM base AS deps
COPY package*.json ./
RUN npm install --production

# Build stage
FROM base AS builder
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production stage
FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Copy migration files
COPY prisma ./prisma/

# Install Prisma CLI for migrations
RUN npm install -g prisma

# Create startup script
RUN echo "#!/bin/sh\n\
    echo 'Running database migrations...'\n\
    prisma migrate deploy\n\
    echo 'Starting application...'\n\
    node dist/server.js" > ./start.sh && \
    chmod +x ./start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["./start.sh"]