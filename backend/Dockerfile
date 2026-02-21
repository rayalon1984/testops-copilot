# Stage 1: Base
# Use alpine for minimal footprint
FROM node:20-alpine AS base
WORKDIR /app
# Install OpenSSL (required for Prisma Client)
RUN apk add --no-cache openssl
ENV NODE_ENV=production

# Stage 2: Development
# Hot-reload development server
FROM base AS development
ENV NODE_ENV=development
RUN apk add --no-cache python3 make g++
COPY package*.json ./
# Use --ignore-scripts to skip Prisma's auto-generate (wrong schema at this point)
RUN npm install --ignore-scripts
# Rebuild native modules (bcrypt, etc.) that were skipped by --ignore-scripts
RUN npm rebuild bcrypt
COPY . .
# Use PostgreSQL schema for Docker development (DATABASE_URL points to Postgres)
RUN cp prisma/schema.production.prisma prisma/schema.prisma
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]

# Stage 3: Builder
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

# Stage 4: Production dependencies
# Separate stage with build tools to compile native modules (bcrypt)
FROM base AS deps-production
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 5: Production
# Final image with only production dependencies and artifacts
FROM base AS production
# Copy production node_modules with pre-compiled native modules
COPY --from=deps-production /app/node_modules ./node_modules
# Copy package files (for npm scripts and metadata)
COPY package*.json ./
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