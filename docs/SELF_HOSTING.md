# 🏠 Self-Hosting Guide - Inopay

## Overview

This guide explains how to deploy Inopay on your own infrastructure for complete sovereignty.

## Prerequisites

- **VPS**: Ubuntu 22.04+ with min 2GB RAM, 20GB storage
- **Docker**: v24+ with Docker Compose
- **Domain**: (Optional) For HTTPS

---

## Quick Start

### 1. Clone & Configure

```bash
# Get the liberation pack
git clone https://github.com/your-org/inopay-liberated.git
cd inopay-liberated

# Configure environment
cp .env.example .env
nano .env
```

### 2. Environment Variables

```bash
# .env file

# Database
DATABASE_URL=postgresql://inopay:changeme@postgres:5432/inopay
POSTGRES_USER=inopay
POSTGRES_PASSWORD=changeme
POSTGRES_DB=inopay

# Application
NODE_ENV=production
PORT=3000

# AI (Optional - for code cleaning)
AI_PROVIDER=ollama
AI_BASE_URL=http://ollama:11434
AI_MODEL=llama3

# Email (Optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-password

# Domain (if using HTTPS)
DOMAIN=inopay.yourdomain.com
SSL_EMAIL=admin@yourdomain.com
```

### 3. Deploy

```bash
docker compose up -d
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Caddy (HTTPS)               │
│              Port 80/443                    │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼───────┐   ┌───────▼───────┐
│   Frontend    │   │   Backend     │
│   (Nginx)     │   │   (Node.js)   │
│   Port 80     │   │   Port 3000   │
└───────────────┘   └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
      ┌───────▼───┐  ┌──────▼──┐  ┌──────▼───┐
      │ PostgreSQL│  │ MinIO   │  │ Ollama   │
      │ Port 5432 │  │ Port 9000│ │ Port 11434│
      └───────────┘  └─────────┘  └──────────┘
```

---

## docker-compose.yml

```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NODE_ENV=production
    depends_on:
      - postgres
    restart: unless-stopped

  # Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-inopay}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: ${POSTGRES_DB:-inopay}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  # Object Storage (optional)
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped

  # AI Engine (optional)
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]

volumes:
  postgres_data:
  minio_data:
  ollama_data:
```

---

## SSL/HTTPS Setup

### Option A: Caddy (Automatic HTTPS)

```bash
# Caddyfile
yourdomain.com {
    reverse_proxy frontend:80
    
    handle /api/* {
        reverse_proxy backend:3000
    }
}
```

### Option B: Let's Encrypt + Nginx

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d yourdomain.com

# Auto-renewal
crontab -e
# Add: 0 0 * * * certbot renew --quiet
```

---

## Database Setup

### Initialize Schema

```sql
-- database/init.sql

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE liberation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    audit_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add more tables as needed
```

### Migrations

```bash
# Run migrations
docker compose exec backend npm run migrate

# Or manually
docker compose exec postgres psql -U inopay -d inopay -f /migrations/001_initial.sql
```

---

## Ollama Setup (Local AI)

```bash
# Pull a model
docker compose exec ollama ollama pull llama3

# Test
docker compose exec ollama ollama run llama3 "Hello"

# List models
docker compose exec ollama ollama list
```

### Recommended Models

| Model | Size | Use Case |
|-------|------|----------|
| llama3 | 4.7GB | General purpose |
| codellama | 3.8GB | Code generation |
| mistral | 4.1GB | Fast inference |

---

## Backup & Restore

### Backup

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/$DATE

mkdir -p $BACKUP_DIR

# Database
docker compose exec -T postgres pg_dump -U inopay inopay > $BACKUP_DIR/db.sql

# Files
docker compose exec -T minio mc mirror /data $BACKUP_DIR/storage

# Compress
tar -czf /backups/inopay-$DATE.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

echo "Backup created: /backups/inopay-$DATE.tar.gz"
```

### Restore

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

# Extract
tar -xzf $BACKUP_FILE -C /tmp/restore

# Database
docker compose exec -T postgres psql -U inopay -d inopay < /tmp/restore/db.sql

# Files
docker compose exec -T minio mc mirror /tmp/restore/storage /data
```

---

## Monitoring

### Basic Health Check

```bash
#!/bin/bash
# health.sh

# Check services
docker compose ps

# Check logs
docker compose logs --tail=50

# Check disk
df -h

# Check memory
free -m
```

### Prometheus + Grafana (Advanced)

```yaml
# Add to docker-compose.yml

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

---

## Security Hardening

### Firewall

```bash
# UFW setup
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Fail2ban

```bash
apt install fail2ban

cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
maxretry = 3
bantime = 3600
EOF

systemctl restart fail2ban
```

### Docker Secrets

```bash
# Create secrets
echo "your-password" | docker secret create db_password -

# Use in compose
services:
  postgres:
    secrets:
      - db_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    external: true
```

---

## Updates

```bash
# Pull latest
git pull origin main

# Rebuild
docker compose build --no-cache

# Restart
docker compose down
docker compose up -d

# Cleanup
docker system prune -af
```

---

## Troubleshooting

### Container won't start

```bash
docker compose logs <service-name>
docker compose exec <service-name> sh
```

### Database connection issues

```bash
# Test connection
docker compose exec postgres psql -U inopay -d inopay -c "SELECT 1"

# Check logs
docker compose logs postgres
```

### Out of disk space

```bash
# Clean Docker
docker system prune -af --volumes

# Check large files
du -sh /var/lib/docker/*
```

---

## Support

- Documentation: https://inopay.app/docs
- Community: https://discord.gg/inopay
- Email: support@inopay.app

---

*© 2024 Inovaq Canada Inc. - Souveraineté numérique.*
