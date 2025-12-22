#!/bin/bash

# ================================================
# Script de déploiement des Edge Functions
# Inopay - Migration vers Supabase autonome
# ================================================

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Inopay - Déploiement des Edge Functions${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Vérifier si supabase CLI est installé
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI n'est pas installé${NC}"
    echo -e "${YELLOW}Installez-le avec: npm install -g supabase${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI détecté${NC}"

# Vérifier si l'utilisateur est connecté
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vous n'êtes pas connecté à Supabase${NC}"
    echo -e "${BLUE}Connexion en cours...${NC}"
    supabase login
fi

echo -e "${GREEN}✓ Connecté à Supabase${NC}"

# Demander le project ref si pas lié
if [ ! -f ".supabase/config.toml" ] && [ ! -f "supabase/.temp/project-ref" ]; then
    echo ""
    echo -e "${YELLOW}Le projet n'est pas encore lié à Supabase.${NC}"
    read -p "Entrez votre Project Reference (ex: abcdefghijklmnop): " PROJECT_REF
    
    if [ -z "$PROJECT_REF" ]; then
        echo -e "${RED}❌ Project Reference requis${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Liaison au projet ${PROJECT_REF}...${NC}"
    supabase link --project-ref "$PROJECT_REF"
fi

echo -e "${GREEN}✓ Projet lié${NC}"
echo ""

# Liste des fonctions à déployer
FUNCTIONS=(
    "admin-list-payments"
    "admin-list-subscriptions"
    "admin-list-users"
    "admin-manage-subscription"
    "admin-manage-tester"
    "auto-restart-container"
    "check-deployment"
    "check-server-status"
    "check-subscription"
    "clean-code"
    "cleanup-coolify-orphans"
    "cleanup-secrets"
    "cleanup-storage"
    "configure-database"
    "convert-edge-to-backend"
    "create-checkout"
    "customer-portal"
    "deploy-coolify"
    "deploy-direct"
    "deploy-ftp"
    "diff-clean"
    "export-schema"
    "export-to-github"
    "extract-rls-policies"
    "fetch-github-repo"
    "generate-archive"
    "generate-docker-alternatives"
    "get-user-credits"
    "github-sync-webhook"
    "health-monitor"
    "list-github-repos"
    "migrate-schema"
    "provision-hetzner-vps"
    "purge-server-deployments"
    "rolling-update"
    "send-email"
    "send-liberation-report"
    "send-newsletter-welcome"
    "send-reminder-emails"
    "serve-setup-script"
    "setup-callback"
    "setup-database"
    "setup-vps"
    "stripe-webhook"
    "sync-coolify-status"
    "use-credit"
    "validate-coolify-token"
    "widget-auth"
)

TOTAL=${#FUNCTIONS[@]}
SUCCESS=0
FAILED=0
FAILED_FUNCTIONS=()

echo -e "${BLUE}Déploiement de ${TOTAL} fonctions...${NC}"
echo ""

# Déployer chaque fonction
for i in "${!FUNCTIONS[@]}"; do
    FUNC="${FUNCTIONS[$i]}"
    NUM=$((i + 1))
    
    echo -ne "${BLUE}[$NUM/$TOTAL]${NC} Déploiement de ${FUNC}... "
    
    if supabase functions deploy "$FUNC" --no-verify-jwt 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((SUCCESS++))
    else
        echo -e "${RED}✗${NC}"
        ((FAILED++))
        FAILED_FUNCTIONS+=("$FUNC")
    fi
done

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Résumé du déploiement${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}✓ Succès: ${SUCCESS}/${TOTAL}${NC}"

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}✗ Échecs: ${FAILED}/${TOTAL}${NC}"
    echo ""
    echo -e "${YELLOW}Fonctions en échec:${NC}"
    for FUNC in "${FAILED_FUNCTIONS[@]}"; do
        echo -e "  - ${RED}${FUNC}${NC}"
    done
    echo ""
    echo -e "${YELLOW}Pour réessayer une fonction spécifique:${NC}"
    echo -e "  supabase functions deploy [FUNCTION_NAME]"
fi

echo ""
echo -e "${BLUE}================================================${NC}"

# Afficher les prochaines étapes si tout est OK
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Toutes les fonctions ont été déployées !${NC}"
    echo ""
    echo -e "${YELLOW}Prochaines étapes:${NC}"
    echo -e "  1. Configurer les secrets dans le dashboard Supabase"
    echo -e "  2. Configurer le webhook Stripe"
    echo -e "  3. Tester les fonctions"
    echo ""
    echo -e "${BLUE}Pour voir les logs d'une fonction:${NC}"
    echo -e "  supabase functions logs [FUNCTION_NAME]"
fi

exit $FAILED
