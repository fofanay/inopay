#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# INOPAY LIBERATOR - Script d'installation Runner CI/CD
# Compatible: Ubuntu 22.04+ / Debian 12+
# Supporte: GitHub Actions Runner & GitLab Runner
# ═══════════════════════════════════════════════════════════════

set -e

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════
RUNNER_USER="runner"
RUNNER_HOME="/home/$RUNNER_USER"
RUNNER_WORKDIR="/opt/actions-runner"
GITLAB_RUNNER_CONFIG="/etc/gitlab-runner/config.toml"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════
# Fonctions utilitaires
# ═══════════════════════════════════════════════════════════════
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Ce script doit être exécuté en tant que root (sudo)"
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "Impossible de détecter l'OS"
    fi
    log_info "OS détecté: $OS $VERSION"
}

# ═══════════════════════════════════════════════════════════════
# Installation Docker
# ═══════════════════════════════════════════════════════════════
install_docker() {
    log_info "Installation de Docker..."
    
    # Vérifier si Docker est déjà installé
    if command -v docker &> /dev/null; then
        log_success "Docker déjà installé: $(docker --version)"
        return 0
    fi
    
    # Mise à jour système
    apt-get update -qq
    apt-get install -y -qq \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Ajouter la clé GPG Docker
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Ajouter le repo Docker
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Installer Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Démarrer Docker
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker installé: $(docker --version)"
}

# ═══════════════════════════════════════════════════════════════
# Création utilisateur runner
# ═══════════════════════════════════════════════════════════════
create_runner_user() {
    log_info "Création de l'utilisateur $RUNNER_USER..."
    
    if id "$RUNNER_USER" &>/dev/null; then
        log_success "Utilisateur $RUNNER_USER existe déjà"
    else
        useradd -m -s /bin/bash $RUNNER_USER
        log_success "Utilisateur $RUNNER_USER créé"
    fi
    
    # Ajouter au groupe docker
    usermod -aG docker $RUNNER_USER
    
    log_success "Utilisateur $RUNNER_USER ajouté au groupe docker"
}

# ═══════════════════════════════════════════════════════════════
# Installation GitHub Actions Runner
# ═══════════════════════════════════════════════════════════════
install_github_runner() {
    log_info "Installation GitHub Actions Runner..."
    
    # Paramètres requis
    GITHUB_REPO=${1:-""}
    GITHUB_TOKEN=${2:-""}
    
    if [ -z "$GITHUB_REPO" ] || [ -z "$GITHUB_TOKEN" ]; then
        log_warning "Usage: install_runner.sh github <repo_url> <token>"
        log_info "Exemple: install_runner.sh github https://github.com/user/repo AXXXX..."
        return 1
    fi
    
    # Créer le répertoire
    mkdir -p $RUNNER_WORKDIR
    cd $RUNNER_WORKDIR
    
    # Télécharger le runner
    RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | grep -oP '"tag_name": "v\K[^"]+')
    log_info "Version runner: $RUNNER_VERSION"
    
    curl -o actions-runner-linux-x64.tar.gz -L \
        "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
    
    tar xzf actions-runner-linux-x64.tar.gz
    rm actions-runner-linux-x64.tar.gz
    
    # Configurer le runner
    chown -R $RUNNER_USER:$RUNNER_USER $RUNNER_WORKDIR
    
    sudo -u $RUNNER_USER ./config.sh \
        --url "$GITHUB_REPO" \
        --token "$GITHUB_TOKEN" \
        --unattended \
        --replace \
        --name "inopay-runner-$(hostname)" \
        --labels "self-hosted,Linux,X64,inopay,docker"
    
    # Installer le service
    ./svc.sh install $RUNNER_USER
    ./svc.sh start
    
    log_success "GitHub Actions Runner installé et démarré!"
    log_info "Status: ./svc.sh status"
}

# ═══════════════════════════════════════════════════════════════
# Installation GitLab Runner
# ═══════════════════════════════════════════════════════════════
install_gitlab_runner() {
    log_info "Installation GitLab Runner..."
    
    # Paramètres requis
    GITLAB_URL=${1:-"https://gitlab.com"}
    GITLAB_TOKEN=${2:-""}
    
    if [ -z "$GITLAB_TOKEN" ]; then
        log_warning "Usage: install_runner.sh gitlab <gitlab_url> <token>"
        log_info "Exemple: install_runner.sh gitlab https://gitlab.com glrt-xxx..."
        return 1
    fi
    
    # Installer GitLab Runner
    curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | bash
    apt-get install -y gitlab-runner
    
    # Enregistrer le runner
    gitlab-runner register \
        --non-interactive \
        --url "$GITLAB_URL" \
        --token "$GITLAB_TOKEN" \
        --executor "docker" \
        --docker-image "docker:24-dind" \
        --docker-privileged \
        --docker-volumes "/var/run/docker.sock:/var/run/docker.sock" \
        --docker-volumes "/cache" \
        --description "inopay-runner-$(hostname)" \
        --tag-list "docker,linux,inopay,self-hosted" \
        --run-untagged="true" \
        --locked="false"
    
    # Démarrer le service
    systemctl enable gitlab-runner
    systemctl restart gitlab-runner
    
    log_success "GitLab Runner installé et démarré!"
    log_info "Status: systemctl status gitlab-runner"
}

# ═══════════════════════════════════════════════════════════════
# Configuration Docker pour CI
# ═══════════════════════════════════════════════════════════════
configure_docker_ci() {
    log_info "Configuration Docker pour CI/CD..."
    
    # Créer la configuration Docker daemon
    mkdir -p /etc/docker
    cat > /etc/docker/daemon.json << 'EOF'
{
    "storage-driver": "overlay2",
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "live-restore": true,
    "default-ulimits": {
        "nofile": {
            "Name": "nofile",
            "Hard": 65536,
            "Soft": 65536
        }
    }
}
EOF
    
    # Redémarrer Docker
    systemctl restart docker
    
    # Créer le réseau CI si nécessaire
    docker network create ci-network 2>/dev/null || true
    
    # Installer docker-compose standalone (pour compatibilité)
    if ! command -v docker-compose &> /dev/null; then
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
            -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        log_success "docker-compose installé"
    fi
    
    log_success "Docker configuré pour CI/CD"
}

# ═══════════════════════════════════════════════════════════════
# Installation des outils supplémentaires
# ═══════════════════════════════════════════════════════════════
install_tools() {
    log_info "Installation des outils supplémentaires..."
    
    apt-get install -y -qq \
        git \
        curl \
        wget \
        jq \
        zip \
        unzip \
        htop \
        net-tools \
        build-essential
    
    # Installer Node.js 20
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        log_success "Node.js installé: $(node --version)"
    fi
    
    log_success "Outils supplémentaires installés"
}

# ═══════════════════════════════════════════════════════════════
# Configuration Firewall
# ═══════════════════════════════════════════════════════════════
configure_firewall() {
    log_info "Configuration du firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp   # SSH
        ufw allow 80/tcp   # HTTP
        ufw allow 443/tcp  # HTTPS
        ufw --force enable
        log_success "UFW configuré"
    fi
}

# ═══════════════════════════════════════════════════════════════
# Nettoyage automatique
# ═══════════════════════════════════════════════════════════════
setup_cleanup() {
    log_info "Configuration du nettoyage automatique..."
    
    # Cron pour nettoyer Docker
    cat > /etc/cron.daily/docker-cleanup << 'EOF'
#!/bin/bash
docker system prune -af --volumes 2>/dev/null || true
docker image prune -af --filter "until=168h" 2>/dev/null || true
EOF
    chmod +x /etc/cron.daily/docker-cleanup
    
    log_success "Nettoyage automatique configuré"
}

# ═══════════════════════════════════════════════════════════════
# Afficher le résumé
# ═══════════════════════════════════════════════════════════════
show_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "${GREEN}✅ Installation terminée!${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "📋 Récapitulatif:"
    echo "   • Docker: $(docker --version 2>/dev/null || echo 'Non installé')"
    echo "   • Node.js: $(node --version 2>/dev/null || echo 'Non installé')"
    echo "   • Utilisateur runner: $RUNNER_USER"
    echo ""
    echo "📝 Prochaines étapes:"
    echo ""
    echo "   Pour GitHub Actions:"
    echo "   sudo $0 github https://github.com/user/repo <RUNNER_TOKEN>"
    echo ""
    echo "   Pour GitLab CI:"
    echo "   sudo $0 gitlab https://gitlab.com <REGISTRATION_TOKEN>"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
}

# ═══════════════════════════════════════════════════════════════
# Point d'entrée principal
# ═══════════════════════════════════════════════════════════════
main() {
    check_root
    detect_os
    
    case "${1:-install}" in
        github)
            install_docker
            create_runner_user
            configure_docker_ci
            install_tools
            install_github_runner "$2" "$3"
            setup_cleanup
            ;;
        gitlab)
            install_docker
            create_runner_user
            configure_docker_ci
            install_tools
            install_gitlab_runner "$2" "$3"
            setup_cleanup
            ;;
        install|"")
            install_docker
            create_runner_user
            configure_docker_ci
            install_tools
            configure_firewall
            setup_cleanup
            show_summary
            ;;
        docker-only)
            install_docker
            configure_docker_ci
            ;;
        *)
            echo "Usage: $0 [install|github|gitlab|docker-only]"
            echo ""
            echo "Commands:"
            echo "  install      - Installation complète (Docker + outils)"
            echo "  github       - Installer GitHub Actions Runner"
            echo "  gitlab       - Installer GitLab Runner"
            echo "  docker-only  - Installer uniquement Docker"
            exit 1
            ;;
    esac
}

# Exécuter
main "$@"
