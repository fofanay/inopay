import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const setupId = url.searchParams.get('id');

    if (!setupId) {
      return new Response('Missing setup ID', { status: 400 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify setup ID exists and is pending
    const { data: server, error } = await supabase
      .from('user_servers')
      .select('*')
      .eq('setup_id', setupId)
      .single();

    if (error || !server) {
      return new Response('Invalid setup ID', { status: 404 });
    }

    if (server.status === 'ready') {
      return new Response('echo "Coolify est déjà installé sur ce serveur"', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Update status to installing
    await supabase
      .from('user_servers')
      .update({ status: 'installing' })
      .eq('id', server.id);

    const callbackUrl = `${supabaseUrl}/functions/v1/setup-callback`;
    const setupDbUrl = `${supabaseUrl}/functions/v1/setup-database`;

    // Generate bash script for Coolify installation + PostgreSQL auto-setup
    const script = `#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              INOPAY - Installation Automatique             ║"
echo "║          Docker + Coolify + PostgreSQL + SSL Auto          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Helper function to escape JSON special characters
escape_json() {
  local str="$1"
  str=\${str//\\\\/\\\\\\\\}
  str=\${str//\\"/\\\\\\"}
  str=\${str//$'\\t'/\\\\t}
  str=\${str//$'\\n'/\\\\n}
  str=\${str//$'\\r'/\\\\r}
  echo "$str"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "\${RED}❌ Veuillez exécuter ce script en tant que root (sudo).\${NC}"
  exit 1
fi

echo -e "\${YELLOW}📦 Étape 1/7 : Mise à jour du système...\${NC}"
apt-get update -qq
apt-get upgrade -y -qq

echo -e "\${YELLOW}🐳 Étape 2/7 : Installation de Docker...\${NC}"
if command -v docker &> /dev/null; then
  echo -e "\${GREEN}✓ Docker est déjà installé\${NC}"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "\${GREEN}✓ Docker installé avec succès\${NC}"
fi

echo -e "\${YELLOW}🚀 Étape 3/7 : Installation de Coolify...\${NC}"
if [ -d "/data/coolify" ]; then
  echo -e "\${GREEN}✓ Coolify est déjà installé\${NC}"
else
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
  echo -e "\${GREEN}✓ Coolify installé avec succès\${NC}"
fi

echo -e "\${YELLOW}⏳ Attente du démarrage de Coolify (60 secondes max)...\${NC}"
for i in {1..60}; do
  if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo -e "\${GREEN}✓ Coolify est opérationnel\${NC}"
    break
  fi
  sleep 1
done

echo -e "\${YELLOW}🐘 Étape 4/7 : Installation de PostgreSQL...\${NC}"

# Initialize DB credentials
DB_NAME="inopay_production"
DB_USER="inopay_user"
DB_PASSWORD_ACTUAL=""

# Check if our specific container already exists
if docker ps -a | grep -q "inopay-postgres"; then
  echo -e "\${BLUE}  Container inopay-postgres trouvé, récupération des credentials...\${NC}"
  
  # Container exists, try to get the password from it
  if docker ps | grep -q "inopay-postgres"; then
    # Container is running
    DB_PASSWORD_ACTUAL=$(docker inspect inopay-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2 || echo "")
    
    if [ -n "$DB_PASSWORD_ACTUAL" ]; then
      echo -e "\${GREEN}✓ Credentials PostgreSQL récupérés\${NC}"
    else
      echo -e "\${YELLOW}⚠ Impossible de récupérer le mot de passe, recréation du container...\${NC}"
      docker stop inopay-postgres 2>/dev/null || true
      docker rm inopay-postgres 2>/dev/null || true
    fi
  else
    # Container exists but not running, remove it
    echo -e "\${YELLOW}  Container arrêté, suppression et recréation...\${NC}"
    docker rm inopay-postgres 2>/dev/null || true
  fi
fi

# Create new container if password not found
if [ -z "$DB_PASSWORD_ACTUAL" ]; then
  echo -e "\${BLUE}  Création d'un nouveau container PostgreSQL...\${NC}"
  
  # Generate secure password (alphanumeric only to avoid JSON issues)
  DB_PASSWORD_ACTUAL=$(openssl rand -hex 16)
  
  # Create PostgreSQL container via Docker
  docker run -d \\
    --name inopay-postgres \\
    --restart always \\
    -e POSTGRES_DB=$DB_NAME \\
    -e POSTGRES_USER=$DB_USER \\
    -e POSTGRES_PASSWORD=$DB_PASSWORD_ACTUAL \\
    -p 5432:5432 \\
    -v inopay_pgdata:/var/lib/postgresql/data \\
    postgres:15-alpine
  
  echo -e "\${GREEN}✓ PostgreSQL installé avec succès\${NC}"
  echo -e "\${BLUE}  Base de données : $DB_NAME\${NC}"
  echo -e "\${BLUE}  Utilisateur : $DB_USER\${NC}"
fi

echo -e "\${YELLOW}⏳ Étape 5/7 : Attente du démarrage de PostgreSQL (30 secondes max)...\${NC}"
for i in {1..30}; do
  if docker exec inopay-postgres pg_isready -U $DB_USER > /dev/null 2>&1; then
    echo -e "\${GREEN}✓ PostgreSQL est opérationnel\${NC}"
    break
  fi
  sleep 1
done

echo -e "\${YELLOW}🔑 Étape 6/7 : Récupération du token Coolify...\${NC}"
COOLIFY_TOKEN=""

# Try to get Coolify API token from .env
if [ -f /data/coolify/.env ]; then
  COOLIFY_TOKEN=$(grep -E "^API_TOKEN=" /data/coolify/.env 2>/dev/null | cut -d= -f2 || echo "")
  if [ -z "$COOLIFY_TOKEN" ]; then
    # Try alternative key name
    COOLIFY_TOKEN=$(grep -E "^APP_KEY=" /data/coolify/.env 2>/dev/null | cut -d= -f2 || echo "")
  fi
fi

if [ -n "$COOLIFY_TOKEN" ]; then
  echo -e "\${GREEN}✓ Token Coolify récupéré\${NC}"
else
  echo -e "\${YELLOW}⚠ Token Coolify non trouvé (configuration manuelle requise)\${NC}"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "${server.ip_address}")

echo -e "\${YELLOW}📡 Étape 7/7 : Configuration du callback Inopay...\${NC}"

# Verify we have the password
if [ -z "$DB_PASSWORD_ACTUAL" ]; then
  echo -e "\${RED}⚠ ATTENTION: Mot de passe PostgreSQL non disponible\${NC}"
  echo -e "\${YELLOW}  Tentative de récupération depuis le container...\${NC}"
  DB_PASSWORD_ACTUAL=$(docker inspect inopay-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep POSTGRES_PASSWORD | cut -d= -f2 || echo "")
fi

# Escape password for JSON
DB_PASSWORD_ESCAPED=$(escape_json "$DB_PASSWORD_ACTUAL")
COOLIFY_TOKEN_ESCAPED=$(escape_json "$COOLIFY_TOKEN")

# Debug info (masked)
echo -e "\${BLUE}  IP: $SERVER_IP\${NC}"
echo -e "\${BLUE}  DB Password length: \${#DB_PASSWORD_ACTUAL} chars\${NC}"
echo -e "\${BLUE}  Coolify Token: \${COOLIFY_TOKEN:+trouvé}\${COOLIFY_TOKEN:-non trouvé}\${NC}"

# Send callback to Inopay with DB credentials - WITH RETRY (3 attempts)
echo -e "\${BLUE}Envoi des informations à Inopay...\${NC}"
CALLBACK_SUCCESS=false
for attempt in 1 2 3; do
  echo -e "\${BLUE}  Tentative $attempt/3...\${NC}"
  
  CALLBACK_RESPONSE=$(curl -s -w "\\n%{http_code}" -X POST "${callbackUrl}" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"setup_id\\": \\"${setupId}\\",
      \\"server_ip\\": \\"$SERVER_IP\\",
      \\"coolify_port\\": 8000,
      \\"coolify_token\\": \\"$COOLIFY_TOKEN_ESCAPED\\",
      \\"status\\": \\"ready\\",
      \\"db_host\\": \\"$SERVER_IP\\",
      \\"db_port\\": 5432,
      \\"db_name\\": \\"$DB_NAME\\",
      \\"db_user\\": \\"$DB_USER\\",
      \\"db_password\\": \\"$DB_PASSWORD_ESCAPED\\"
    }")
  
  HTTP_CODE=$(echo "$CALLBACK_RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$CALLBACK_RESPONSE" | head -n -1)
  
  if [ "$HTTP_CODE" = "200" ]; then
    CALLBACK_SUCCESS=true
    echo -e "\${GREEN}  ✓ Callback réussi\${NC}"
    break
  else
    echo -e "\${YELLOW}  ⚠ Échec (HTTP $HTTP_CODE)\${NC}"
    echo -e "\${YELLOW}  Réponse: $RESPONSE_BODY\${NC}"
    echo -e "\${YELLOW}  Nouvelle tentative dans $((attempt * 5))s...\${NC}"
    sleep $((attempt * 5))
  fi
done

if [ "$CALLBACK_SUCCESS" = false ]; then
  echo -e "\${RED}❌ Impossible de contacter Inopay après 3 tentatives.\${NC}"
  echo -e "\${YELLOW}   Veuillez vérifier votre connexion et réessayer.\${NC}"
  echo ""
  echo -e "\${BLUE}📋 Informations pour configuration manuelle:\${NC}"
  echo -e "   DB Host: $SERVER_IP"
  echo -e "   DB Port: 5432"
  echo -e "   DB Name: $DB_NAME"
  echo -e "   DB User: $DB_USER"
  echo -e "   DB Password: $DB_PASSWORD_ACTUAL"
fi

echo ""
echo -e "\${GREEN}╔════════════════════════════════════════════════════════════╗"
echo -e "║           ✅ INSTALLATION TERMINÉE AVEC SUCCÈS !           ║"
echo -e "╚════════════════════════════════════════════════════════════╝\${NC}"
echo ""
echo -e "🌐 Coolify est accessible sur : \${YELLOW}http://$SERVER_IP:8000\${NC}"
echo -e "🐘 PostgreSQL est accessible sur : \${YELLOW}$SERVER_IP:5432\${NC}"
echo ""
echo -e "📱 Retournez sur Inopay pour continuer la configuration."
echo ""
`;

    console.log(`Serving setup script for setup_id: ${setupId}`);

    return new Response(script, {
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error: unknown) {
    console.error('Error in serve-setup-script:', error);
    return new Response(`echo "Erreur: ${error instanceof Error ? error.message : 'Unknown error'}"`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});
