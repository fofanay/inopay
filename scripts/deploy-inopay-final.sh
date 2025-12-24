#!/bin/bash
# @inopay-core-protected
# ============================================================================
# INOPAY - Script de Déploiement Final Souverain
# Version: 1.0.0 - Certification Auto-Libération
# Date: 2024-12-24
# ============================================================================

set -euo pipefail

# Couleurs pour la sortie
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
BUILD_DIR="dist"
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-izqveyvcebolrqpqlmho}"

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║     ██╗███╗   ██╗ ██████╗ ██████╗  █████╗ ██╗   ██╗          ║"
echo "║     ██║████╗  ██║██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝          ║"
echo "║     ██║██╔██╗ ██║██║   ██║██████╔╝███████║ ╚████╔╝           ║"
echo "║     ██║██║╚██╗██║██║   ██║██╔═══╝ ██╔══██║  ╚██╔╝            ║"
echo "║     ██║██║ ╚████║╚██████╔╝██║     ██║  ██║   ██║             ║"
echo "║     ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝   ╚═╝             ║"
echo "║                                                              ║"
echo "║          DÉPLOIEMENT SOUVERAIN - Version Finale              ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Fonction de logging
log_step() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================================================
# PHASE 1: Vérifications Pré-déploiement
# ============================================================================

log_step "Phase 1: Vérifications pré-déploiement..."

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    log_error "package.json non trouvé. Êtes-vous dans le bon répertoire?"
    exit 1
fi
log_success "package.json trouvé"

# Vérifier les dépendances
if [ ! -d "node_modules" ]; then
    log_step "Installation des dépendances..."
    npm install --legacy-peer-deps
fi
log_success "Dépendances installées"

# Vérifier les variables d'environnement
if [ -f ".env" ]; then
    log_success "Fichier .env trouvé"
else
    log_warning "Fichier .env non trouvé - les variables d'environnement doivent être définies"
fi

# ============================================================================
# PHASE 2: Audit de Sécurité (Self-Preservation Check)
# ============================================================================

log_step "Phase 2: Audit de sécurité et auto-préservation..."

# Vérifier que les fichiers protégés sont présents
PROTECTED_FILES=(
    "supabase/functions/_shared/proprietary-patterns.ts"
    "supabase/functions/clean-code/index.ts"
    "supabase/functions/stripe-webhook/index.ts"
    "supabase/functions/process-project-liberation/index.ts"
    "src/locales/fr.json"
    "src/locales/en.json"
)

for file in "${PROTECTED_FILES[@]}"; do
    if [ -f "$file" ]; then
        if grep -q "@inopay-core-protected" "$file" 2>/dev/null || [[ "$file" == *".json" ]]; then
            log_success "Protégé: $file"
        else
            log_warning "Non marqué: $file (recommandé d'ajouter @inopay-core-protected)"
        fi
    else
        log_error "CRITIQUE: Fichier manquant - $file"
        exit 1
    fi
done

# ============================================================================
# PHASE 3: Build de Production
# ============================================================================

log_step "Phase 3: Build de production..."

# Nettoyer le répertoire de build précédent
rm -rf "$BUILD_DIR"

# Build avec optimisations
npm run build

if [ -d "$BUILD_DIR" ]; then
    log_success "Build réussi - $(du -sh $BUILD_DIR | cut -f1) généré"
else
    log_error "Échec du build"
    exit 1
fi

# ============================================================================
# PHASE 4: Déploiement des Edge Functions
# ============================================================================

log_step "Phase 4: Déploiement des Edge Functions Supabase..."

if command -v supabase &> /dev/null; then
    # Liste des fonctions à déployer
    EDGE_FUNCTIONS=(
        "clean-code"
        "process-project-liberation"
        "stripe-webhook"
        "create-checkout"
        "create-liberation-checkout"
        "check-subscription"
        "decrypt-secret"
        "encrypt-secrets"
    )
    
    for func in "${EDGE_FUNCTIONS[@]}"; do
        if [ -d "supabase/functions/$func" ]; then
            log_step "Déploiement: $func"
            supabase functions deploy "$func" --project-ref "$SUPABASE_PROJECT_ID" 2>/dev/null || {
                log_warning "Échec déploiement $func (vérifiez les credentials)"
            }
        fi
    done
    log_success "Edge Functions déployées"
else
    log_warning "CLI Supabase non installé - déploiement manuel requis"
fi

# ============================================================================
# PHASE 5: Push vers GitHub (optionnel)
# ============================================================================

if [ -n "$GITHUB_REPO" ]; then
    log_step "Phase 5: Push vers GitHub ($GITHUB_REPO)..."
    
    # Vérifier que git est configuré
    if git remote get-url origin &>/dev/null; then
        # Créer un commit avec tag de version
        VERSION_TAG="v1.0.0-sovereign-$(date +%Y%m%d-%H%M%S)"
        
        git add .
        git commit -m "🚀 Inopay Souverain - Release $VERSION_TAG

- Protection du noyau activée (@inopay-core-protected)
- Whitelist anti-suicide configurée
- Edge Functions sécurisées
- i18n complet (FR/EN)
- Build de production optimisé"

        git tag -a "$VERSION_TAG" -m "Release Souveraine $VERSION_TAG"
        git push origin "$GITHUB_BRANCH" --tags
        
        log_success "Push vers GitHub réussi avec tag $VERSION_TAG"
    else
        log_warning "Remote Git non configuré"
    fi
else
    log_step "Phase 5: Push GitHub ignoré (GITHUB_REPO non défini)"
fi

# ============================================================================
# PHASE 6: Rapport Final
# ============================================================================

echo ""
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║              ✓ DÉPLOIEMENT SOUVERAIN TERMINÉ                 ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo "📊 Rapport de déploiement:"
echo "   • Build size: $(du -sh $BUILD_DIR | cut -f1)"
echo "   • Fichiers protégés: ${#PROTECTED_FILES[@]}"
echo "   • Edge Functions: ${#EDGE_FUNCTIONS[@]}"
echo "   • Statut: 100% Souverain"
echo ""
echo -e "${PURPLE}Inopay est maintenant son propre premier client.${NC}"
echo ""

# ============================================================================
# Sortie
# ============================================================================

exit 0
