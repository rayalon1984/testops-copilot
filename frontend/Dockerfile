# syntax=docker/dockerfile:1.4

# Base stage for both development and production
FROM node:18-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV VITE_API_URL=http://localhost:3000
ENV VITE_WEBSOCKET_URL=ws://localhost:3000

# Development stage
FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

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
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check for production
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]