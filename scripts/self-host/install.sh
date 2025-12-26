#!/bin/bash
# ============================================
# INOPAY SELF-HOST INSTALLER
# Version 1.0.0
# ============================================
#
# Usage: curl -sSL https://inopay.io/install.sh | bash
#        ou: ./install.sh --domain votre-domaine.com
#
# Ce script installe une instance complète d'Inopay sur votre VPS

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Bannière
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ██╗███╗   ██╗ ██████╗ ██████╗  █████╗ ██╗   ██╗           ║"
echo "║   ██║████╗  ██║██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝           ║"
echo "║   ██║██╔██╗ ██║██║   ██║██████╔╝███████║ ╚████╔╝            ║"
echo "║   ██║██║╚██╗██║██║   ██║██╔═══╝ ██╔══██║  ╚██╔╝             ║"
echo "║   ██║██║ ╚████║╚██████╔╝██║     ██║  ██║   ██║              ║"
echo "║   ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝   ╚═╝              ║"
echo "║                                                              ║"
echo "║              🚀 Self-Host Installer v1.0.0 🚀                ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé. Installation..."
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        log_success "Docker installé"
    else
        log_success "Docker OK"
    fi
    
    # Vérifier Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose n'est pas installé. Installation..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        log_success "Docker Compose installé"
    else
        log_success "Docker Compose OK"
    fi
    
    # Vérifier la RAM
    TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_RAM" -lt 3500 ]; then
        log_warning "RAM insuffisante: ${TOTAL_RAM}MB (recommandé: 4GB+)"
    else
        log_success "RAM OK: ${TOTAL_RAM}MB"
    fi
    
    # Vérifier l'espace disque
    DISK_SPACE=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
    if [ "$DISK_SPACE" -lt 15 ]; then
        log_warning "Espace disque faible: ${DISK_SPACE}GB (recommandé: 20GB+)"
    else
        log_success "Espace disque OK: ${DISK_SPACE}GB"
    fi
}

# Générer des secrets sécurisés
generate_secrets() {
    log_info "Génération des secrets..."
    
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    SUPABASE_ANON_KEY=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    SUPABASE_SERVICE_KEY=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    MINIO_ACCESS_KEY=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    MINIO_SECRET_KEY=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    MEILISEARCH_API_KEY=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
    
    log_success "Secrets générés"
}

# Créer le fichier .env
create_env_file() {
    log_info "Création du fichier .env..."
    
    cat > .env << EOF
# INOPAY Self-Host Configuration
# Généré le $(date)

# Domain (remplacez par votre domaine)
DOMAIN=${DOMAIN:-localhost}
SITE_URL=https://${DOMAIN:-localhost}
API_EXTERNAL_URL=https://${DOMAIN:-localhost}

# PostgreSQL
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=3600

# Supabase Keys
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}

# MinIO
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}

# MeiliSearch
MEILISEARCH_API_KEY=${MEILISEARCH_API_KEY}

# Désactiver l'inscription publique (optionnel)
DISABLE_SIGNUP=false

# URLs de redirection additionnelles (séparées par des virgules)
ADDITIONAL_REDIRECT_URLS=
EOF

    chmod 600 .env
    log_success "Fichier .env créé"
}

# Télécharger les fichiers de configuration
download_config_files() {
    log_info "Téléchargement des fichiers de configuration..."
    
    mkdir -p inopay-self-host
    cd inopay-self-host
    
    # Docker Compose
    curl -sSL https://raw.githubusercontent.com/inopay/inopay/main/scripts/self-host/docker-compose.inopay.yml -o docker-compose.yml
    
    # Caddyfile
    curl -sSL https://raw.githubusercontent.com/inopay/inopay/main/scripts/self-host/Caddyfile -o Caddyfile
    
    # Kong configuration
    curl -sSL https://raw.githubusercontent.com/inopay/inopay/main/scripts/self-host/kong.yml -o kong.yml
    
    # Init DB
    curl -sSL https://raw.githubusercontent.com/inopay/inopay/main/scripts/self-host/init-db.sql -o init-db.sql
    
    log_success "Fichiers téléchargés"
}

# Lancer les services
start_services() {
    log_info "Démarrage des services..."
    
    # Pull des images
    docker-compose pull
    
    # Démarrer
    docker-compose up -d
    
    log_success "Services démarrés"
}

# Vérifier l'état des services
check_services() {
    log_info "Vérification des services..."
    
    sleep 30 # Attendre que tous les services démarrent
    
    # Vérifier chaque service
    services=("inopay-frontend" "inopay-supabase-db" "inopay-supabase-kong" "inopay-minio" "inopay-meilisearch")
    
    for service in "${services[@]}"; do
        if docker ps | grep -q "$service"; then
            log_success "$service: Running"
        else
            log_error "$service: Not running"
        fi
    done
}

# Afficher les informations de connexion
show_connection_info() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║               🎉 INSTALLATION TERMINÉE ! 🎉                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Accès à Inopay:${NC}"
    echo "  Frontend: https://${DOMAIN:-localhost}"
    echo "  API: https://${DOMAIN:-localhost}/rest/v1/"
    echo ""
    echo -e "${BLUE}Consoles d'administration:${NC}"
    echo "  MinIO: https://minio.${DOMAIN:-localhost}"
    echo "  MeiliSearch: https://search.${DOMAIN:-localhost}"
    echo ""
    echo -e "${BLUE}Secrets générés (stockés dans .env):${NC}"
    echo "  PostgreSQL Password: ${POSTGRES_PASSWORD:0:8}..."
    echo "  JWT Secret: ${JWT_SECRET:0:16}..."
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Sauvegardez votre fichier .env en lieu sûr !${NC}"
    echo ""
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--domain votre-domaine.com]"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done
}

# Main
main() {
    parse_args "$@"
    
    check_prerequisites
    generate_secrets
    download_config_files
    create_env_file
    start_services
    check_services
    show_connection_info
}

main "$@"
