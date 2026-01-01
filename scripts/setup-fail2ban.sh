#!/bin/bash

# ===========================================
# Script d'installation et configuration de Fail2ban
# Protection contre les attaques par force brute
# ===========================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Vérifier les droits root
if [ "$EUID" -ne 0 ]; then
    log_error "Ce script doit être exécuté en tant que root (sudo)"
    exit 1
fi

log_info "Installation de Fail2ban..."

# Détecter le gestionnaire de paquets
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y fail2ban
elif command -v yum &> /dev/null; then
    yum install -y epel-release
    yum install -y fail2ban
elif command -v dnf &> /dev/null; then
    dnf install -y fail2ban
else
    log_error "Gestionnaire de paquets non supporté"
    exit 1
fi

log_info "Configuration de Fail2ban..."

# Créer le fichier de configuration local
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# Durée de bannissement par défaut (1 heure)
bantime = 3600

# Fenêtre de temps pour compter les tentatives
findtime = 600

# Nombre de tentatives avant bannissement
maxretry = 5

# Action par défaut
banaction = iptables-multiport

# Email pour les notifications (optionnel)
# destemail = admin@example.com
# sendername = Fail2Ban
# mta = sendmail
# action = %(action_mwl)s

# Ignorer certaines IPs (localhost, IPs internes)
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16

# ============================================
# JAIL SSH - Protection contre les attaques SSH
# ============================================
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600

# ============================================
# JAIL NGINX - Protection des requêtes HTTP
# ============================================
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400
findtime = 3600

[nginx-bad-request]
enabled = true
filter = nginx-bad-request
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 5
bantime = 3600

[nginx-req-limit]
enabled = true
filter = nginx-req-limit
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 7200

# ============================================
# JAIL INOPAY - Protection spécifique à l'application
# ============================================
[inopay-api]
enabled = true
filter = inopay-api
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 50
bantime = 1800
findtime = 300

[inopay-auth]
enabled = true
filter = inopay-auth
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 5
bantime = 3600
findtime = 600

[inopay-payment]
enabled = true
filter = inopay-payment
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 10
bantime = 3600
findtime = 300
EOF

log_info "Création des filtres personnalisés..."

# Filtre pour les bots malveillants
cat > /etc/fail2ban/filter.d/nginx-botsearch.conf << 'EOF'
[Definition]
failregex = ^<HOST> - .* "(GET|POST|HEAD).*(\.php|\.asp|\.aspx|\.jsp|\.cgi|wp-admin|wp-login|phpmyadmin|xmlrpc|\.env|\.git|\.svn).*" (404|403|500) .*$
ignoreregex =
EOF

# Filtre pour les requêtes malformées
cat > /etc/fail2ban/filter.d/nginx-bad-request.conf << 'EOF'
[Definition]
failregex = ^<HOST> - .* "(GET|POST|HEAD|PUT|DELETE|OPTIONS).*" 400 .*$
            ^<HOST> - .* "(GET|POST|HEAD|PUT|DELETE|OPTIONS).*" 403 .*$
            ^<HOST> - .* ".*\.\." .*$
ignoreregex =
EOF

# Filtre pour le rate limiting Nginx
cat > /etc/fail2ban/filter.d/nginx-req-limit.conf << 'EOF'
[Definition]
failregex = limiting requests, excess:.* by zone.*client: <HOST>
ignoreregex =
EOF

# Filtre spécifique Inopay API
cat > /etc/fail2ban/filter.d/inopay-api.conf << 'EOF'
[Definition]
failregex = ^<HOST> - .* "POST /api/.* HTTP/.*" 429 .*$
            ^<HOST> - .* "GET /api/.* HTTP/.*" 429 .*$
ignoreregex =
EOF

# Filtre spécifique Inopay Auth
cat > /etc/fail2ban/filter.d/inopay-auth.conf << 'EOF'
[Definition]
failregex = ^<HOST> - .* "POST /api/auth.* HTTP/.*" (401|403) .*$
            ^<HOST> - .* "POST /api/send-otp.* HTTP/.*" (429|400) .*$
            ^<HOST> - .* "POST /api/verify-otp.* HTTP/.*" (401|400) .*$
ignoreregex =
EOF

# Filtre spécifique Inopay Payment
cat > /etc/fail2ban/filter.d/inopay-payment.conf << 'EOF'
[Definition]
failregex = ^<HOST> - .* "POST /api/create-checkout.* HTTP/.*" (400|429) .*$
            ^<HOST> - .* "POST /api/stripe-webhook.* HTTP/.*" (400|401) .*$
ignoreregex =
EOF

log_info "Activation et démarrage de Fail2ban..."

# Activer et démarrer le service
systemctl enable fail2ban
systemctl restart fail2ban

# Afficher le statut
log_info "Vérification de la configuration..."
fail2ban-client status

log_info "========================================"
log_info "Fail2ban installé et configuré avec succès!"
log_info "========================================"
log_info ""
log_info "Commandes utiles:"
log_info "  - Statut général: fail2ban-client status"
log_info "  - Statut d'un jail: fail2ban-client status sshd"
log_info "  - Débannir une IP: fail2ban-client set sshd unbanip <IP>"
log_info "  - Logs: tail -f /var/log/fail2ban.log"
log_info ""
log_info "Jails activés:"
fail2ban-client status | grep "Jail list" | sed 's/.*:[ \t]*//'
EOF
