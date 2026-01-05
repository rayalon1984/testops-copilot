# syntax=docker/dockerfile:1.4

# Base stage for both development and production
FROM node:20-alpine AS base
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
FROM base AS prod-deps
COPY package*.json ./
RUN npm install --production

# Build stage
FROM base AS builder
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
RUN cp prisma/schema.production.prisma prisma/schema.prisma
RUN npx prisma@5 generate
RUN npm run build

# Production stage
FROM base AS production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Copy migration files
COPY prisma ./prisma/

# Install Prisma CLI for migrations (pin to v5 to avoid v7 breaking changes)
RUN npm install -g prisma@5

# Ensure production schema is used
RUN cp prisma/schema.production.prisma prisma/schema.prisma
RUN prisma generate

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["/app/start.sh"]