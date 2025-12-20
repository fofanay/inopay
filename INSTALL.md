# 🚀 Inopay - Guide d'Installation Complet

## 📋 Prérequis

- **Node.js** 20+ LTS
- **Docker** et **Docker Compose**
- **PostgreSQL** 15+ (ou Supabase)

## 🛠️ Installation Rapide

### 1. Cloner et configurer

```bash
git clone <votre-repo>
cd inopay

# Copier les variables d'environnement
cp .env.example .env
```

### 2. Éditer `.env`

Remplissez toutes les variables nécessaires dans le fichier `.env`.

### 3. Développement local

```bash
# Frontend
npm install
npm run dev

# Backend (dans un autre terminal)
cd backend
npm install
npm run dev
```

### 4. Production avec Docker

```bash
# Build et démarrage
docker-compose up -d

# Ou pour la production
docker-compose -f docker-compose.prod.yml up -d
```

## 🏗️ Structure du Projet

```
inopay/
├── src/                    # Frontend React
├── backend/                # API Express
│   └── src/
│       ├── routes/         # Endpoints API
│       ├── services/       # Services (Supabase, etc.)
│       └── middleware/     # Auth, etc.
├── database/               # Migrations SQL
├── Dockerfile              # Build frontend
├── docker-compose.yml      # Orchestration dev
├── docker-compose.prod.yml # Orchestration prod
└── nginx.conf              # Config serveur web
```

## 🔒 Sécurité

- Les credentials FTP ne sont JAMAIS stockés
- Toutes les clés API sont en variables d'environnement
- JWT pour l'authentification
- CORS configuré

## 🌐 Déploiement

### Option 1: VPS avec Docker

```bash
scp -r . user@server:/app/inopay
ssh user@server
cd /app/inopay
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: IONOS / OVH

1. Build local: `npm run build`
2. Upload `dist/` via FTP
3. Configurer `.htaccess` pour SPA

## 📞 Support

- Email: support@inopay.app
- Documentation: https://docs.inopay.app

---

**Inopay** - Libérez votre code !
