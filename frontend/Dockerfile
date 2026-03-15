# Base stage for both development and production
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Development stage
FROM base AS development
ENV NODE_ENV=development
ENV VITE_API_URL=http://localhost:4000
ENV VITE_WEBSOCKET_URL=ws://localhost:4000
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Build stage — VITE_API_URL is empty so the frontend uses relative URLs
# which nginx proxies to the backend via /api/ location block
FROM base AS builder
ENV NODE_ENV=development
ENV VITE_API_URL=
ENV VITE_WEBSOCKET_URL=
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check for production
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=5s \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]