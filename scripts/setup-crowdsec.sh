#!/bin/bash

# ===========================================
# Script d'installation et configuration de CrowdSec
# WAF communautaire open-source
# ===========================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Vérifier les droits root
if [ "$EUID" -ne 0 ]; then
    log_error "Ce script doit être exécuté en tant que root (sudo)"
    exit 1
fi

log_info "========================================"
log_info "Installation de CrowdSec - WAF Open Source"
log_info "========================================"

# Détecter l'OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    log_error "Impossible de détecter l'OS"
    exit 1
fi

log_info "OS détecté: $OS $VER"

# Installation selon l'OS
log_step "1/6 - Installation de CrowdSec..."

if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    curl -s https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh | bash
    apt-get install -y crowdsec
elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"Fedora"* ]]; then
    curl -s https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.rpm.sh | bash
    yum install -y crowdsec || dnf install -y crowdsec
else
    log_error "OS non supporté: $OS"
    exit 1
fi

log_step "2/6 - Installation du bouncer Nginx..."

if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    apt-get install -y crowdsec-nginx-bouncer
elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"Fedora"* ]]; then
    yum install -y crowdsec-nginx-bouncer || dnf install -y crowdsec-nginx-bouncer
fi

log_step "3/6 - Installation des collections de détection..."

# Collection pour Nginx
cscli collections install crowdsecurity/nginx

# Collection pour les attaques web génériques
cscli collections install crowdsecurity/base-http-scenarios

# Collection pour les scanners et bots
cscli collections install crowdsecurity/http-cve

# Collection pour le brute-force
cscli collections install crowdsecurity/http-bf

# Collection Linux de base
cscli collections install crowdsecurity/linux

# Whitelists
cscli collections install crowdsecurity/whitelist-good-actors

log_step "4/6 - Configuration de CrowdSec..."

# Configuration des acquisitions pour Nginx
cat > /etc/crowdsec/acquis.d/nginx.yaml << 'EOF'
filenames:
  - /var/log/nginx/access.log
  - /var/log/nginx/error.log
labels:
  type: nginx
---
filenames:
  - /var/log/nginx/*access*.log
labels:
  type: nginx
---
filenames:
  - /var/log/nginx/*error*.log
labels:
  type: nginx
EOF

# Configuration personnalisée pour Inopay
cat > /etc/crowdsec/acquis.d/inopay.yaml << 'EOF'
# Logs spécifiques Inopay si disponibles
filenames:
  - /var/log/inopay/*.log
labels:
  type: syslog
---
# Logs Docker si utilisés
source: docker
container_name:
  - inopay-frontend
  - inopay-backend
labels:
  type: nginx
EOF

log_step "5/6 - Configuration du bouncer Nginx..."

# Obtenir la clé API du bouncer
BOUNCER_KEY=$(cscli bouncers add nginx-bouncer -o raw 2>/dev/null || echo "")

if [ -z "$BOUNCER_KEY" ]; then
    log_warn "Le bouncer existe déjà, récupération de la configuration existante..."
else
    # Configurer le bouncer
    cat > /etc/crowdsec/bouncers/crowdsec-nginx-bouncer.conf << EOF
API_KEY=${BOUNCER_KEY}
API_URL=http://127.0.0.1:8080
MODE=live
BAN_TEMPLATE_PATH=/var/lib/crowdsec/lua/templates/ban.html
CAPTCHA_TEMPLATE_PATH=/var/lib/crowdsec/lua/templates/captcha.html
REDIRECT_LOCATION=
EXCLUDE_LOCATION=
EOF
fi

# Créer une page de bannissement personnalisée
mkdir -p /var/lib/crowdsec/lua/templates
cat > /var/lib/crowdsec/lua/templates/ban.html << 'EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accès Bloqué - Inopay</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 500px;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: #ff6b6b;
        }
        p {
            color: #b8b8b8;
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }
        .info {
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 1rem;
            font-size: 0.875rem;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🛡️</div>
        <h1>Accès Temporairement Bloqué</h1>
        <p>
            Notre système de sécurité a détecté une activité suspecte 
            provenant de votre adresse IP.
        </p>
        <p>
            Si vous pensez qu'il s'agit d'une erreur, veuillez patienter 
            quelques minutes puis réessayer, ou contactez notre support.
        </p>
        <div class="info">
            Votre IP sera automatiquement débloquée après expiration 
            du délai de sécurité.
        </div>
    </div>
</body>
</html>
EOF

log_step "6/6 - Démarrage des services..."

# Activer et démarrer CrowdSec
systemctl enable crowdsec
systemctl restart crowdsec

# Redémarrer Nginx pour appliquer le bouncer
systemctl restart nginx || log_warn "Nginx non installé ou échec du redémarrage"

# Attendre que CrowdSec démarre
sleep 3

# Afficher le statut
log_info "========================================"
log_info "CrowdSec installé et configuré avec succès!"
log_info "========================================"
echo ""

log_info "Statut des services:"
cscli machines list
echo ""

log_info "Bouncers configurés:"
cscli bouncers list
echo ""

log_info "Collections installées:"
cscli collections list
echo ""

log_info "Commandes utiles:"
echo "  - Voir les alertes: cscli alerts list"
echo "  - Voir les décisions: cscli decisions list"
echo "  - Débloquer une IP: cscli decisions delete --ip <IP>"
echo "  - Métriques: cscli metrics"
echo "  - Mettre à jour: cscli hub update && cscli hub upgrade"
echo ""

log_info "Dashboard CrowdSec (optionnel):"
echo "  Pour installer le dashboard, exécutez:"
echo "  cscli console enroll <YOUR_CONSOLE_TOKEN>"
echo ""
echo "  Obtenez votre token sur: https://app.crowdsec.net"
EOF
