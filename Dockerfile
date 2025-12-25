# ============================================
# INOPAY - Dockerfile Frontend (Production)
# Multi-stage build optimized
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Debug: Show build context
RUN echo "=== Build context check ===" && pwd

# Copy package files first (layer caching)
COPY package.json ./
COPY package-lock.json* bun.lockb* ./

# Debug: Verify package.json
RUN echo "=== Package files ===" && ls -la package*.json

# Install dependencies (always use npm install for compatibility)
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Debug: Show copied files
RUN echo "=== Source files ===" && ls -la

# Environment variables for build (passed as build args)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build
RUN npm run build

# Debug: Verify build output
RUN echo "=== Build output ===" && ls -la dist/

# Stage 2: Production with Nginx
FROM nginx:alpine AS production

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
