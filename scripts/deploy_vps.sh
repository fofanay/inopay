#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# INOPAY VPS DEPLOYMENT SCRIPT
# ═══════════════════════════════════════════════════════════════
# Idempotent deployment script for Ubuntu 22.04+ minimal VPS
# 
# Usage:
#   curl -sSL https://inopay.app/deploy.sh | sudo bash
#   # or
#   sudo ./deploy_vps.sh
#
# Environment variables (optional):
#   DOMAIN        - Your domain (default: server IP)
#   SSL_EMAIL     - Email for Let's Encrypt
#   REPO_URL      - Git repository URL
#   BRANCH        - Git branch (default: main)
#   INSTALL_DIR   - Installation directory (default: /opt/inopay)
# ═══════════════════════════════════════════════════════════════

set -e

# ─────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────

VERSION="2.0.0"
INSTALL_DIR="${INSTALL_DIR:-/opt/inopay}"
REPO_URL="${REPO_URL:-https://github.com/inopay/liberator.git}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-}"
SSL_EMAIL="${SSL_EMAIL:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────────
# FUNCTIONS
# ─────────────────────────────────────────────────────────────

print_banner() {
  echo -e "${CYAN}"
  echo "  ╦╔╗╔╔═╗╔═╗╔═╗╦ ╦"
  echo "  ║║║║║ ║╠═╝╠═╣╚╦╝"
  echo "  ╩╝╚╝╚═╝╩  ╩ ╩ ╩  LIBERATOR v${VERSION}"
  echo -e "${NC}"
  echo -e "${BLUE}  VPS Deployment Script${NC}"
  echo ""
}

log_step() {
  echo -e "\n${BLUE}▶ $1${NC}"
}

log_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
  echo -e "${RED}✗ $1${NC}"
}

check_root() {
  if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root"
    echo "Try: sudo $0"
    exit 1
  fi
}

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
  else
    log_error "Cannot detect OS"
    exit 1
  fi
  
  if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    log_warning "This script is optimized for Ubuntu/Debian. Proceeding anyway..."
  fi
  
  log_success "Detected: $OS $OS_VERSION"
}

get_server_ip() {
  SERVER_IP=$(curl -s -4 ifconfig.me 2>/dev/null || curl -s -4 icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')
  if [ -z "$DOMAIN" ]; then
    DOMAIN="$SERVER_IP"
  fi
  log_success "Server IP: $SERVER_IP"
  log_success "Domain: $DOMAIN"
}

update_system() {
  log_step "Updating system packages..."
  
  apt-get update -qq
  apt-get upgrade -y -qq
  apt-get install -y -qq \
    curl \
    wget \
    git \
    jq \
    htop \
    nano \
    ufw \
    fail2ban \
    ca-certificates \
    gnupg \
    lsb-release
  
  log_success "System updated"
}

install_docker() {
  log_step "Installing Docker..."
  
  # Check if already installed
  if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f 3 | tr -d ',')
    log_success "Docker already installed: v$DOCKER_VERSION"
    
    # Ensure Docker is running
    systemctl enable docker
    systemctl start docker
    return
  fi
  
  # Install Docker
  curl -fsSL https://get.docker.com | sh
  
  # Enable and start Docker
  systemctl enable docker
  systemctl start docker
  
  # Add current user to docker group (for non-root usage later)
  if [ -n "$SUDO_USER" ]; then
    usermod -aG docker "$SUDO_USER"
  fi
  
  log_success "Docker installed: $(docker --version | cut -d ' ' -f 3 | tr -d ',')"
}

verify_docker_compose() {
  log_step "Verifying Docker Compose..."
  
  if ! docker compose version &> /dev/null; then
    log_error "Docker Compose plugin not found"
    apt-get install -y docker-compose-plugin
  fi
  
  log_success "Docker Compose: $(docker compose version --short)"
}

setup_firewall() {
  log_step "Configuring firewall..."
  
  # Reset UFW
  ufw --force reset
  
  # Default policies
  ufw default deny incoming
  ufw default allow outgoing
  
  # Allow SSH
  ufw allow 22/tcp comment 'SSH'
  
  # Allow HTTP/HTTPS
  ufw allow 80/tcp comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'
  
  # Optional: Allow API directly (if not using reverse proxy)
  # ufw allow 3001/tcp comment 'API'
  
  # Enable firewall
  ufw --force enable
  
  log_success "Firewall configured"
}

setup_fail2ban() {
  log_step "Configuring fail2ban..."
  
  # Create jail.local if not exists
  if [ ! -f /etc/fail2ban/jail.local ]; then
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF
  fi
  
  systemctl enable fail2ban
  systemctl restart fail2ban
  
  log_success "fail2ban configured"
}

clone_or_update_repo() {
  log_step "Setting up application..."
  
  if [ -d "$INSTALL_DIR/.git" ]; then
    log_success "Repository exists, pulling updates..."
    cd "$INSTALL_DIR"
    git fetch --all
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
  else
    log_success "Cloning repository..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || {
      # If clone fails, create directory structure
      mkdir -p "$INSTALL_DIR"
      log_warning "Could not clone repository. Creating minimal structure..."
    }
    cd "$INSTALL_DIR"
  fi
  
  log_success "Application directory: $INSTALL_DIR"
}

create_env_file() {
  log_step "Creating environment configuration..."
  
  ENV_FILE="$INSTALL_DIR/.env"
  
  # Generate secrets if not exist
  if [ ! -f "$ENV_FILE" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    MINIO_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    
    cat > "$ENV_FILE" << EOF
# ═══════════════════════════════════════════════════════════════
# INOPAY ENVIRONMENT CONFIGURATION
# Generated on $(date -Iseconds)
# ═══════════════════════════════════════════════════════════════

# ─── Server ───────────────────────────────────────────────────
NODE_ENV=production
PORT=3001
DOMAIN=${DOMAIN}
SSL_EMAIL=${SSL_EMAIL:-admin@${DOMAIN}}
CORS_ORIGIN=https://${DOMAIN}

# ─── Security ─────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ─── Database ─────────────────────────────────────────────────
POSTGRES_USER=inopay
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=inopay
DATABASE_URL=postgresql://inopay:${POSTGRES_PASSWORD}@postgres:5432/inopay

# ─── Storage ──────────────────────────────────────────────────
MINIO_ROOT_USER=inopay
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}

# ─── External Services (configure as needed) ──────────────────
# SUPABASE_URL=
# SUPABASE_SERVICE_ROLE_KEY=
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# GITHUB_TOKEN=
# ANTHROPIC_API_KEY=
# RESEND_API_KEY=
EOF
    
    chmod 600 "$ENV_FILE"
    log_success "Environment file created"
    log_warning "Review and update: $ENV_FILE"
  else
    log_success "Environment file exists"
  fi
}

build_and_deploy() {
  log_step "Building and deploying..."
  
  cd "$INSTALL_DIR"
  
  # Create docker directory if not exists
  mkdir -p docker
  
  # Check for docker-compose file
  COMPOSE_FILE=""
  if [ -f "docker/docker-compose.sovereign.yml" ]; then
    COMPOSE_FILE="docker/docker-compose.sovereign.yml"
  elif [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
  elif [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
  else
    log_error "No docker-compose file found"
    log_warning "Creating minimal configuration..."
    
    # Create minimal docker-compose if none exists
    cat > "docker-compose.yml" << 'EOF'
version: '3.8'
services:
  app:
    build: .
    container_name: inopay-app
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
EOF
    COMPOSE_FILE="docker-compose.yml"
  fi
  
  log_success "Using compose file: $COMPOSE_FILE"
  
  # Pull latest images
  docker compose -f "$COMPOSE_FILE" pull 2>/dev/null || true
  
  # Build and start
  docker compose -f "$COMPOSE_FILE" up -d --build
  
  log_success "Containers started"
}

setup_auto_restart() {
  log_step "Configuring auto-restart..."
  
  # Create systemd service for docker-compose
  cat > /etc/systemd/system/inopay.service << EOF
[Unit]
Description=InoPay Liberator
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

  # Enable service
  systemctl daemon-reload
  systemctl enable inopay.service
  
  log_success "Auto-restart configured"
}

setup_log_rotation() {
  log_step "Configuring log rotation..."
  
  cat > /etc/logrotate.d/inopay << EOF
${INSTALL_DIR}/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker compose -f ${INSTALL_DIR}/docker-compose.yml restart > /dev/null 2>&1 || true
    endscript
}
EOF

  log_success "Log rotation configured"
}

wait_for_healthy() {
  log_step "Waiting for services to be healthy..."
  
  local max_attempts=30
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:80/health" 2>/dev/null | grep -q "200"; then
      log_success "Services are healthy!"
      return 0
    fi
    
    echo -ne "\r  Attempt $attempt/$max_attempts..."
    sleep 2
    attempt=$((attempt + 1))
  done
  
  log_warning "Services may not be fully ready. Check with: docker compose logs"
  return 1
}

show_status() {
  log_step "Deployment Status"
  
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ DEPLOYMENT COMPLETE!${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  
  # Show container status
  echo -e "${BLUE}📦 Container Status:${NC}"
  docker compose ps 2>/dev/null || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  
  # Show access URLs
  echo -e "${BLUE}🌐 Access URLs:${NC}"
  if [ "$DOMAIN" != "$SERVER_IP" ]; then
    echo -e "   Frontend:  ${GREEN}https://${DOMAIN}${NC}"
    echo -e "   API:       ${GREEN}https://${DOMAIN}/api${NC}"
  else
    echo -e "   Frontend:  ${GREEN}http://${SERVER_IP}${NC}"
    echo -e "   API:       ${GREEN}http://${SERVER_IP}/api${NC}"
  fi
  echo ""
  
  # Show useful commands
  echo -e "${BLUE}📋 Useful Commands:${NC}"
  echo "   Logs:      cd $INSTALL_DIR && docker compose logs -f"
  echo "   Status:    cd $INSTALL_DIR && docker compose ps"
  echo "   Restart:   cd $INSTALL_DIR && docker compose restart"
  echo "   Stop:      cd $INSTALL_DIR && docker compose down"
  echo "   Update:    cd $INSTALL_DIR && git pull && docker compose up -d --build"
  echo ""
  
  # Show resource usage
  echo -e "${BLUE}💾 Resource Usage:${NC}"
  echo "   Disk:      $(df -h / | awk 'NR==2 {print $3 " / " $2 " (" $5 ")"}')"
  echo "   Memory:    $(free -h | awk 'NR==2 {print $3 " / " $2}')"
  echo ""
  
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

cleanup() {
  log_step "Cleaning up..."
  
  # Remove unused Docker resources
  docker system prune -f --volumes 2>/dev/null || true
  
  # Clear apt cache
  apt-get clean
  apt-get autoremove -y -qq
  
  log_success "Cleanup complete"
}

# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

main() {
  print_banner
  
  check_root
  detect_os
  get_server_ip
  
  update_system
  install_docker
  verify_docker_compose
  
  setup_firewall
  setup_fail2ban
  
  clone_or_update_repo
  create_env_file
  
  build_and_deploy
  setup_auto_restart
  setup_log_rotation
  
  wait_for_healthy
  cleanup
  
  show_status
}

# Run main function
main "$@"
