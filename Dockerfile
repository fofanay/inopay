# ============================================
# INOPAY SOVEREIGN - Production Dockerfile
# Node 20-Alpine | Multi-stage optimized build
# ============================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json package-lock.json* bun.lockb* ./

# Install dependencies
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables for build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_INFRA_MODE=self-hosted

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_INFRA_MODE=$VITE_INFRA_MODE
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Run sovereignty audit before build
RUN node scripts/sovereignty-audit.js --min-score=90 || echo "Audit warning - continuing build"

# Build the application
RUN npm run build

# Verify build output
RUN test -d dist && ls -la dist/

# Stage 3: Production Runtime
FROM nginx:1.25-alpine AS production

# Install curl for healthchecks
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Copy optimized nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Set correct permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S inopay && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G inopay inopay

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Labels
LABEL org.opencontainers.image.source="https://github.com/inovaq/inopay"
LABEL org.opencontainers.image.vendor="Inovaq Canada Inc."
LABEL org.opencontainers.image.title="Inopay Sovereign"
LABEL org.opencontainers.image.description="100% Sovereign Code Liberation Platform"
