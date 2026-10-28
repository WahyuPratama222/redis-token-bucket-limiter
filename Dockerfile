# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# 1. Copy dependency files first to maximize the Docker cache layer
COPY package*.json ./
RUN npm ci

# 2. Copy the rest of the source code and build
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS production
WORKDIR /app

# tini runs as PID 1 and forwards signals, so the app can shut down gracefully
RUN apk add --no-cache tini

ENV NODE_ENV=production
# Default port; docker-compose overrides PORT per instance (3001 / 3002)
ENV PORT=3000

# Fresh install without devDependencies, so the final layers never contain them
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Security: run as the non-root user built into the node image
USER node

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]