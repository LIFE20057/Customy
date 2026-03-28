# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init unzip

WORKDIR /app

# Copy only package files first for better layer caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init unzip

WORKDIR /app
ENV NODE_ENV=production

# Copy installed modules from build stage
COPY --from=base /app/node_modules ./node_modules

# Copy application source
COPY src/   ./src/
COPY public/ ./public/

# Create site dir (will be overridden by volume mount)
RUN mkdir -p /app/site /app/certs

# Non-root user for security
RUN addgroup -g 1001 -S customy && adduser -S -u 1001 -G customy customy
RUN chown -R customy:customy /app
USER customy

# Ports: HTTP + HTTPS
EXPOSE 3000 3443

# Use dumb-init to handle signals properly (important for Pi)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/auth/login --post-data '{}' --header 'Content-Type:application/json' || exit 1
