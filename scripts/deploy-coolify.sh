#!/bin/bash

# ============================================
# INOPAY SOVEREIGN - Script de Déploiement Coolify
# Déploie automatiquement l'application sur Coolify
# Usage: ./scripts/deploy-coolify.sh [options]
# ============================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration par défaut
COOLIFY_URL="${COOLIFY_URL:-}"
COOLIFY_TOKEN="${COOLIFY_TOKEN:-}"
APP_UUID="${COOLIFY_APP_UUID:-}"
PROJECT_NAME="inopay-sovereign"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
BUILD_PACK="${BUILD_PACK:-dockerfile}"

# Variables d'environnement pré-configurées pour Coolify
declare -A ENV_VARS=(
  ["NODE_ENV"]="production"
  ["VITE_INFRA_MODE"]="self-hosted"
  ["VITE_SUPABASE_URL"]="${VITE_SUPABASE_URL:-}"
  ["VITE_SUPABASE_PUBLISHABLE_KEY"]="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
  ["VITE_SUPABASE_PROJECT_ID"]="${VITE_SUPABASE_PROJECT_ID:-}"
  ["VITE_OLLAMA_BASE_URL"]="${VITE_OLLAMA_BASE_URL:-http://localhost:11434}"
  ["VITE_MEILISEARCH_URL"]="${VITE_MEILISEARCH_URL:-http://localhost:7700}"
  ["VITE_MINIO_URL"]="${VITE_MINIO_URL:-http://localhost:9000}"
)

# Fonctions utilitaires
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_title() {
  echo -e "\n${CYAN}═══ $1 ═══${NC}"
}

show_help() {
  cat << EOF
INOPAY SOVEREIGN - Script de Déploiement Coolify

Usage: $0 [options]

Options:
  -u, --url URL          URL de l'instance Coolify (ex: https://coolify.example.com)
  -t, --token TOKEN      Token API Coolify
  -a, --app UUID         UUID de l'application Coolify
  -b, --branch BRANCH    Branche Git à déployer (défaut: main)
  -e, --env FILE         Fichier .env à charger
  -v, --validate         Valider le build avant déploiement
  -d, --dry-run          Afficher les actions sans les exécuter
  -h, --help             Afficher cette aide

Variables d'environnement:
  COOLIFY_URL            URL de l'instance Coolify
  COOLIFY_TOKEN          Token API Coolify
  COOLIFY_APP_UUID       UUID de l'application

Exemples:
  $0 -u https://coolify.example.com -t abc123 -a app-uuid
  $0 --validate --dry-run
  COOLIFY_URL=https://coolify.example.com $0

EOF
}

# Parse arguments
DRY_RUN=false
VALIDATE=false
ENV_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -u|--url)
      COOLIFY_URL="$2"
      shift 2
      ;;
    -t|--token)
      COOLIFY_TOKEN="$2"
      shift 2
      ;;
    -a|--app)
      APP_UUID="$2"
      shift 2
      ;;
    -b|--branch)
      DEPLOY_BRANCH="$2"
      shift 2
      ;;
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    -v|--validate)
      VALIDATE=true
      shift
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "Option inconnue: $1"
      show_help
      exit 1
      ;;
  esac
done

# Charger fichier .env si spécifié
if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
  log_info "Chargement de $ENV_FILE"
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Vérifications préliminaires
log_title "Vérifications préliminaires"

check_requirements() {
  local missing=0
  
  if ! command -v curl &> /dev/null; then
    log_error "curl n'est pas installé"
    missing=1
  else
    log_success "curl disponible"
  fi
  
  if ! command -v jq &> /dev/null; then
    log_warn "jq n'est pas installé (optionnel pour le parsing JSON)"
  else
    log_success "jq disponible"
  fi
  
  if [[ -z "$COOLIFY_URL" ]]; then
    log_error "COOLIFY_URL non défini"
    missing=1
  else
    log_success "URL Coolify: $COOLIFY_URL"
  fi
  
  if [[ -z "$COOLIFY_TOKEN" ]]; then
    log_error "COOLIFY_TOKEN non défini"
    missing=1
  else
    log_success "Token Coolify configuré"
  fi
  
  if [[ $missing -eq 1 ]]; then
    log_error "Configuration incomplète"
    exit 1
  fi
}

check_requirements

# Validation du build
if [[ "$VALIDATE" == true ]]; then
  log_title "Validation du build"
  
  if [[ -f "scripts/validate-build.js" ]]; then
    if node scripts/validate-build.js --strict; then
      log_success "Build validé"
    else
      log_error "Validation échouée - abandon du déploiement"
      exit 1
    fi
  else
    log_warn "Script de validation non trouvé, skip..."
  fi
fi

# Test de connexion à Coolify
log_title "Test de connexion Coolify"

test_connection() {
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $COOLIFY_TOKEN" \
    "$COOLIFY_URL/api/v1/health" 2>/dev/null || echo "000")
  
  if [[ "$response" == "200" ]]; then
    log_success "Connexion à Coolify OK"
    return 0
  else
    log_error "Impossible de se connecter à Coolify (HTTP $response)"
    return 1
  fi
}

if ! test_connection; then
  exit 1
fi

# Récupération/création de l'application
log_title "Configuration de l'application"

get_or_create_app() {
  if [[ -n "$APP_UUID" ]]; then
    log_info "Utilisation de l'application existante: $APP_UUID"
    
    # Vérifier que l'app existe
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $COOLIFY_TOKEN" \
      "$COOLIFY_URL/api/v1/applications/$APP_UUID")
    
    if [[ "$status" != "200" ]]; then
      log_error "Application $APP_UUID non trouvée"
      exit 1
    fi
    log_success "Application trouvée"
  else
    log_warn "Aucun APP_UUID spécifié"
    log_info "Créez une application dans Coolify et récupérez son UUID"
    log_info "Puis relancez avec: -a <uuid>"
    exit 1
  fi
}

get_or_create_app

# Configuration des variables d'environnement
log_title "Configuration des variables d'environnement"

configure_env_vars() {
  local env_json="{"
  local first=true
  
  for key in "${!ENV_VARS[@]}"; do
    local value="${ENV_VARS[$key]}"
    if [[ -n "$value" ]]; then
      if [[ "$first" != true ]]; then
        env_json+=","
      fi
      env_json+="\"$key\":\"$value\""
      first=false
      log_info "  $key=${value:0:20}..."
    fi
  done
  env_json+="}"
  
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY-RUN] Variables configurées: $env_json"
    return 0
  fi
  
  # Envoyer les variables à Coolify
  local response
  response=$(curl -s -X PATCH \
    -H "Authorization: Bearer $COOLIFY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"environment_variables\": $env_json}" \
    "$COOLIFY_URL/api/v1/applications/$APP_UUID")
  
  if echo "$response" | grep -q "error"; then
    log_error "Erreur configuration env: $response"
    return 1
  fi
  
  log_success "Variables d'environnement configurées"
}

configure_env_vars

# Déclenchement du déploiement
log_title "Déploiement"

trigger_deploy() {
  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY-RUN] Déploiement de la branche $DEPLOY_BRANCH"
    log_success "[DRY-RUN] Simulation terminée"
    return 0
  fi
  
  log_info "Déclenchement du déploiement..."
  
  local response
  response=$(curl -s -X POST \
    -H "Authorization: Bearer $COOLIFY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"force\": true}" \
    "$COOLIFY_URL/api/v1/applications/$APP_UUID/deploy")
  
  if echo "$response" | grep -q "error"; then
    log_error "Erreur de déploiement: $response"
    return 1
  fi
  
  # Extraire l'ID de déploiement si disponible
  local deploy_id
  if command -v jq &> /dev/null; then
    deploy_id=$(echo "$response" | jq -r '.deployment_uuid // empty')
  fi
  
  log_success "Déploiement lancé!"
  
  if [[ -n "$deploy_id" ]]; then
    log_info "ID de déploiement: $deploy_id"
    log_info "Suivre les logs: $COOLIFY_URL/project/*/application/$APP_UUID"
  fi
}

trigger_deploy

# Résumé
log_title "Résumé"

echo ""
echo -e "  ${CYAN}Application:${NC} $APP_UUID"
echo -e "  ${CYAN}Branche:${NC} $DEPLOY_BRANCH"
echo -e "  ${CYAN}Coolify:${NC} $COOLIFY_URL"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}Mode DRY-RUN - Aucune action effectuée${NC}"
else
  echo -e "${GREEN}✅ Déploiement initié avec succès!${NC}"
  echo ""
  echo "Prochaines étapes:"
  echo "  1. Vérifier les logs de build dans Coolify"
  echo "  2. Tester l'URL de l'application une fois déployée"
  echo "  3. Configurer le domaine personnalisé si nécessaire"
fi

echo ""
