// Template docker-compose complet pour le Liberation Pack
export const generateDockerCompose = (options: {
  projectName: string;
  hasBackend: boolean;
  hasDatabase: boolean;
  envVars: string[];
  domain?: string;
}) => {
  const { projectName, hasBackend, hasDatabase, envVars, domain } = options;
  const serviceName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  return `# ============================================
# ${projectName} - Stack de Production
# Généré par InoPay Liberation Pack
# ============================================

version: '3.8'

services:
  # ==========================================
  # Frontend - Application React/Vite
  # ==========================================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: ${serviceName}-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    environment:
      - DOMAIN=\${DOMAIN:-localhost}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      ${hasBackend ? '- backend' : ''}
      ${hasDatabase ? '- postgres' : ''}

${hasBackend ? `
  # ==========================================
  # Backend - API Express.js
  # ==========================================
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${serviceName}-backend
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
${envVars.map(v => `      - ${v}=\${${v}}`).join('\n')}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    ${hasDatabase ? `depends_on:
      postgres:
        condition: service_healthy` : ''}
` : ''}

${hasDatabase ? `
  # ==========================================
  # PostgreSQL - Base de données
  # ==========================================
  postgres:
    image: postgres:15-alpine
    container_name: ${serviceName}-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=\${POSTGRES_USER:-app}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB:-${serviceName}}
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-app} -d \${POSTGRES_DB:-${serviceName}}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # ==========================================
  # pgAdmin - Interface d'administration DB
  # ==========================================
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: ${serviceName}-pgadmin
    restart: unless-stopped
    environment:
      - PGADMIN_DEFAULT_EMAIL=\${PGADMIN_EMAIL:-admin@localhost}
      - PGADMIN_DEFAULT_PASSWORD=\${PGADMIN_PASSWORD:-admin}
      - PGADMIN_CONFIG_SERVER_MODE=False
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    ports:
      - "5050:80"
    networks:
      - app-network
    depends_on:
      - postgres
` : ''}

  # ==========================================
  # Watchtower - Mises à jour automatiques
  # ==========================================
  watchtower:
    image: containrrr/watchtower
    container_name: ${serviceName}-watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=86400
      - WATCHTOWER_INCLUDE_STOPPED=true
    networks:
      - app-network

# ==========================================
# Réseaux
# ==========================================
networks:
  app-network:
    driver: bridge
    name: ${serviceName}-network

# ==========================================
# Volumes persistants
# ==========================================
volumes:
  caddy_data:
    name: ${serviceName}-caddy-data
  caddy_config:
    name: ${serviceName}-caddy-config
${hasDatabase ? `  postgres_data:
    name: ${serviceName}-postgres-data
  pgadmin_data:
    name: ${serviceName}-pgadmin-data` : ''}
`;
};

export const generateCaddyfile = (domain: string, hasBackend: boolean) => {
  return `# Caddyfile - Configuration reverse-proxy avec SSL automatique
# Domaine: ${domain || 'localhost'}

${domain ? `
${domain} {
  # SSL automatique via Let's Encrypt
  tls {
    email {$SSL_EMAIL}
  }

  # Frontend
  handle {
    root * /usr/share/caddy
    try_files {path} /index.html
    file_server
  }

  ${hasBackend ? `
  # API Backend
  handle /api/* {
    reverse_proxy backend:3000
  }

  handle /health {
    reverse_proxy backend:3000
  }
  ` : ''}

  # Headers de sécurité
  header {
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    X-XSS-Protection "1; mode=block"
    Referrer-Policy "strict-origin-when-cross-origin"
  }

  # Compression
  encode gzip

  # Logging
  log {
    output file /var/log/caddy/access.log
    format json
  }
}
` : `
:80 {
  # Mode développement local
  
  root * /usr/share/caddy
  try_files {path} /index.html
  file_server

  ${hasBackend ? `
  handle /api/* {
    reverse_proxy backend:3000
  }

  handle /health {
    reverse_proxy backend:3000
  }
  ` : ''}

  encode gzip
}
`}`;
};

export const generateQuickDeployScript = (projectName: string, hasDatabase: boolean) => {
  return `#!/bin/bash

# ============================================
# Script de déploiement rapide
# ${projectName}
# Généré par InoPay Liberation Pack
# ============================================

set -e

# Couleurs
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🚀 InoPay Liberation Pack Installer               ║"
echo "║                    ${projectName}                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "\${NC}"

# Vérification root
if [ "$EUID" -ne 0 ]; then
  echo -e "\${RED}❌ Ce script doit être exécuté en tant que root\${NC}"
  echo "   Essayez: sudo ./quick-deploy.sh"
  exit 1
fi

# Vérification de l'OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
  VERSION=$VERSION_ID
else
  echo -e "\${RED}❌ Impossible de détecter l'OS\${NC}"
  exit 1
fi

echo -e "\${GREEN}✓ OS détecté: $OS $VERSION\${NC}"

# Installation de Docker si nécessaire
if ! command -v docker &> /dev/null; then
  echo -e "\${YELLOW}📦 Installation de Docker...\${NC}"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "\${GREEN}✓ Docker installé avec succès\${NC}"
else
  echo -e "\${GREEN}✓ Docker déjà installé\${NC}"
fi

# Vérification Docker Compose
if ! docker compose version &> /dev/null; then
  echo -e "\${RED}❌ Docker Compose n'est pas installé\${NC}"
  exit 1
fi

echo -e "\${GREEN}✓ Docker Compose disponible\${NC}"

# Configuration des variables d'environnement
if [ ! -f .env ]; then
  echo -e "\${YELLOW}📝 Configuration des variables d'environnement...\${NC}"
  cp .env.example .env
  
  # Générer des mots de passe aléatoires
  JWT_SECRET=$(openssl rand -base64 32)
  ${hasDatabase ? `POSTGRES_PASSWORD=$(openssl rand -base64 16)
  PGADMIN_PASSWORD=$(openssl rand -base64 12)` : ''}
  
  # Remplacer dans .env
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
  ${hasDatabase ? `sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
  sed -i "s/PGADMIN_PASSWORD=.*/PGADMIN_PASSWORD=$PGADMIN_PASSWORD/" .env` : ''}
  
  echo -e "\${GREEN}✓ Fichier .env configuré\${NC}"
  ${hasDatabase ? `echo -e "\${BLUE}   PostgreSQL Password: $POSTGRES_PASSWORD\${NC}"
  echo -e "\${BLUE}   pgAdmin Password: $PGADMIN_PASSWORD\${NC}"` : ''}
  echo ""
  echo -e "\${YELLOW}⚠️  N'oubliez pas de configurer les autres variables dans .env\${NC}"
else
  echo -e "\${GREEN}✓ Fichier .env existant trouvé\${NC}"
fi

# Demande du domaine
read -p "Entrez votre nom de domaine (ou appuyez sur Entrée pour localhost): " DOMAIN
if [ -n "$DOMAIN" ]; then
  sed -i "s/DOMAIN=.*/DOMAIN=$DOMAIN/" .env
  echo -e "\${GREEN}✓ Domaine configuré: $DOMAIN\${NC}"
fi

# Configuration du pare-feu
if command -v ufw &> /dev/null; then
  echo -e "\${YELLOW}🔒 Configuration du pare-feu...\${NC}"
  ufw allow 22/tcp  # SSH
  ufw allow 80/tcp  # HTTP
  ufw allow 443/tcp # HTTPS
  ${hasDatabase ? `ufw allow 5050/tcp # pgAdmin (optionnel)` : ''}
  echo -e "\${GREEN}✓ Pare-feu configuré\${NC}"
fi

# Démarrage des services
echo -e "\${BLUE}🐳 Démarrage des conteneurs...\${NC}"
docker compose pull
docker compose up -d --build

# Attente du démarrage
echo -e "\${YELLOW}⏳ Attente du démarrage des services...\${NC}"
sleep 10

# Vérification du statut
echo ""
echo -e "\${BLUE}📊 Statut des services:\${NC}"
docker compose ps

# Tests de santé
echo ""
echo -e "\${BLUE}🏥 Vérification de santé:\${NC}"

# Test frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:80 | grep -q "200"; then
  echo -e "\${GREEN}✓ Frontend: OK\${NC}"
else
  echo -e "\${RED}✗ Frontend: Erreur\${NC}"
fi

${hasDatabase ? `
# Test PostgreSQL
if docker compose exec -T postgres pg_isready -U app > /dev/null 2>&1; then
  echo -e "\${GREEN}✓ PostgreSQL: OK\${NC}"
else
  echo -e "\${RED}✗ PostgreSQL: Erreur\${NC}"
fi
` : ''}

# Résumé final
echo ""
echo -e "\${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              🎉 Déploiement terminé !                      ║"
echo "╠════════════════════════════════════════════════════════════╣"
if [ -n "$DOMAIN" ]; then
  echo "║  🌐 Frontend: https://$DOMAIN"
else
  echo "║  🌐 Frontend: http://$(hostname -I | awk '{print $1}')"
fi
${hasDatabase ? `echo "║  📊 pgAdmin:  http://$(hostname -I | awk '{print $1}'):5050"` : ''}
echo "║                                                            ║"
echo "║  📋 Commandes utiles:                                      ║"
echo "║  • Logs:     docker compose logs -f                        ║"
echo "║  • Stop:     docker compose down                           ║"
echo "║  • Restart:  docker compose restart                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "\${NC}"
`;
};

export const generateEnvExample = (envVars: string[], hasDatabase: boolean) => {
  return `# ============================================
# Variables d'environnement
# Copiez ce fichier vers .env et remplissez les valeurs
# ============================================

# Serveur
PORT=3000
NODE_ENV=production
DOMAIN=

# SSL (pour certificats Let's Encrypt)
SSL_EMAIL=

${hasDatabase ? `# Base de données PostgreSQL
POSTGRES_USER=app
POSTGRES_PASSWORD=  # OBLIGATOIRE - Mot de passe sécurisé
POSTGRES_DB=app
DATABASE_URL=postgresql://app:\${POSTGRES_PASSWORD}@postgres:5432/app

# pgAdmin
PGADMIN_EMAIL=admin@localhost
PGADMIN_PASSWORD=  # Mot de passe pour accéder à pgAdmin
` : ''}

# Authentification
JWT_SECRET=  # OBLIGATOIRE - Clé de 32+ caractères (openssl rand -base64 32)

# APIs externes (remplir selon vos besoins)
${envVars
  .filter(v => !['PORT', 'NODE_ENV', 'DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'JWT_SECRET', 'DOMAIN', 'SSL_EMAIL'].includes(v))
  .map(v => `${v}=`)
  .join('\n')}
`;
};
