# ============================================
# INOPAY - Dockerfile Backend (Production)
# ============================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances (npm ci si package-lock existe, sinon npm install)
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      echo "⚠️ package-lock.json absent, utilisation de npm install"; \
      npm install; \
    fi

# Copier le code source
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Copier les dépendances de production
COPY package*.json ./
RUN npm ci --only=production

# Copier le build
COPY --from=builder /app/dist ./dist

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Port
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Démarrer
CMD ["node", "dist/index.js"]
