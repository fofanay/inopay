# 🚀 Guide d'Installation Coolify - Inopay Souverain

Ce guide vous accompagne pour déployer Inopay sur **Coolify** ou tout serveur VPS compatible.

---

## 📋 Prérequis

- **Coolify v4+** installé sur votre VPS
- **Docker** et **Docker Compose** disponibles
- **Supabase** (self-hosted ou cloud)
- Minimum **2 Go RAM**, **10 Go disque**
- Nom de domaine configuré (optionnel mais recommandé)

---

## 🔧 1. Préparation du Projet

### Cloner le dépôt

```bash
git clone https://github.com/VOTRE_ORG/inopay-sovereign.git
cd inopay-sovereign
```

### Vérifier la structure

```
inopay-sovereign/
├── src/                  # Code source React
├── backend/              # API Express (optionnel)
├── public/               # Assets statiques
├── database/             # Migrations SQL
├── Dockerfile            # Build production
├── docker-compose.yml    # Stack complète
├── .env.example          # Variables d'environnement
└── package.json
```

---

## 🔐 2. Variables d'Environnement

Copiez `.env.example` vers `.env` et configurez :

```bash
cp .env.example .env
```

### Variables Requises

```env
# === Mode Infrastructure ===
VITE_INFRA_MODE=self-hosted

# === Supabase ===
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_key
SUPABASE_DB_URL=postgresql://postgres:password@db.votre-projet.supabase.co:5432/postgres

# === Stripe (Paiements) ===
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# === Email (Resend) ===
RESEND_API_KEY=re_xxx

# === IA (Choisir un provider) ===
ANTHROPIC_API_KEY=sk-ant-xxx
# OU
OPENAI_API_KEY=sk-xxx
# OU pour Ollama local
VITE_OLLAMA_BASE_URL=http://localhost:11434

# === GitHub (Export) ===
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx
```

### Variables Optionnelles (Self-Hosted)

```env
# MinIO Storage
VITE_MINIO_URL=http://minio:9000
VITE_MINIO_ACCESS_KEY=minioadmin
VITE_MINIO_SECRET_KEY=votre_secret

# MeiliSearch
VITE_MEILISEARCH_URL=http://meilisearch:7700
VITE_MEILISEARCH_API_KEY=votre_master_key

# Soketi Realtime
VITE_SOKETI_HOST=soketi
VITE_SOKETI_PORT=6001
```

---

## 🐳 3. Déploiement Docker (Manuel)

### Build et démarrage

```bash
# Build l'image
docker build -t inopay:latest .

# Lancer le conteneur
docker run -d \
  --name inopay \
  -p 80:80 \
  --env-file .env \
  inopay:latest
```

### Avec Docker Compose

```bash
docker compose up -d
```

---

## ☁️ 4. Déploiement sur Coolify

### Étape 1 : Créer un nouveau projet

1. Connectez-vous à Coolify
2. Cliquez sur **"+ New Project"**
3. Nommez-le "Inopay"

### Étape 2 : Ajouter l'application

1. Dans le projet, cliquez **"+ New Resource"**
2. Sélectionnez **"Application"**
3. Source : **Git Repository**
4. Entrez l'URL de votre dépôt GitHub

### Étape 3 : Configuration du build

| Paramètre | Valeur |
|-----------|--------|
| **Build Pack** | Dockerfile |
| **Dockerfile Path** | `Dockerfile` |
| **Branch** | `main` |
| **Port** | `80` |

### Étape 4 : Variables d'environnement

Dans l'onglet **"Environment Variables"**, ajoutez toutes les variables de la section 2.

### Étape 5 : Domaine

1. Onglet **"Domains"**
2. Ajoutez votre domaine : `app.votredomaine.com`
3. Activez HTTPS (Let's Encrypt automatique)

### Étape 6 : Déployer

Cliquez sur **"Deploy"** et attendez la fin du build.

---

## 🗄️ 5. Configuration Supabase

### Option A : Supabase Cloud

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Récupérez les clés API
3. Configurez les variables d'environnement

### Option B : Supabase Self-Hosted

```bash
# Dans un dossier séparé
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
docker compose up -d
```

### Migrations de base de données

```bash
# Appliquer les migrations
psql $SUPABASE_DB_URL < database/migrations/001_initial_schema.sql
psql $SUPABASE_DB_URL < database/migrations/002_rls_policies.sql
```

---

## 🤖 6. Configuration IA

### Ollama (Local - Recommandé pour souveraineté)

```bash
# Installer Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Télécharger un modèle
ollama pull llama3

# Configurer
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_OLLAMA_MODEL=llama3
```

### OpenAI / Anthropic

Configurez simplement la clé API correspondante.

---

## ✅ 7. Vérification Post-Déploiement

### Checklist

- [ ] L'application charge correctement
- [ ] La page de connexion fonctionne
- [ ] Les utilisateurs peuvent s'inscrire
- [ ] Le dashboard est accessible
- [ ] Les webhooks Stripe sont configurés
- [ ] Les emails sont envoyés

### Test de santé

```bash
curl https://app.votredomaine.com/
# Devrait retourner le HTML de l'application
```

### Logs

```bash
# Docker
docker logs inopay -f

# Coolify
# Voir dans l'interface > Logs
```

---

## 🔧 8. Dépannage

### Page blanche

```bash
# Vérifier les variables d'environnement
docker exec inopay env | grep VITE

# Vérifier les logs Nginx
docker exec inopay cat /var/log/nginx/error.log
```

### Erreurs CORS

Vérifiez que vos Edge Functions ont les headers CORS corrects.

### Problèmes de build

```bash
# Rebuild complet
docker build --no-cache -t inopay:latest .
```

### Supabase ne répond pas

```bash
# Vérifier la connexion
curl $VITE_SUPABASE_URL/rest/v1/
```

---

## 📚 Ressources

- [Documentation Coolify](https://coolify.io/docs)
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Ollama](https://ollama.com)
- [Support Inopay](mailto:support@inopay.io)

---

## 🎉 Félicitations !

Votre instance Inopay est maintenant **100% souveraine** et déployée sur votre propre infrastructure.

**Aucune dépendance à Lovable, Bolt, ou toute autre plateforme propriétaire.**

---

*© 2024 Inovaq Canada Inc. - Code 100% Souverain*
