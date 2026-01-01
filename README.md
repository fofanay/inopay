# INOPAY - Plateforme de Libération de Code

> **Libérez votre code des dépendances propriétaires et déployez en toute souveraineté.**

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

## 🚀 Qu'est-ce qu'INOPAY?

INOPAY est un PaaS (Platform as a Service) qui permet de:
- **Scanner** votre code pour détecter les dépendances propriétaires
- **Nettoyer** automatiquement les imports et patterns non-portables
- **Reconstruire** avec des alternatives open-source souveraines
- **Déployer** sur votre propre infrastructure (VPS, Coolify, Docker)

## 📦 Installation

### Prérequis
- Node.js 18+ 
- npm ou bun
- Docker (pour le déploiement souverain)

### Installation locale

```bash
# Cloner le repository
git clone <YOUR_GIT_URL>
cd inopay

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

### Installation CLI

```bash
# Installation globale
npm install -g inopay-cli

# Utilisation
inopay liberate ./mon-projet
inopay audit ./mon-projet
inopay scan ./mon-projet
```

## 🏗️ Architecture

```
inopay/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── dashboard/            # Composants du dashboard
│   │   │   └── LiberationPackHub.tsx  # Hub central de libération
│   │   └── ui/                   # Composants UI (shadcn)
│   ├── lib/
│   │   ├── unifiedLiberator.ts   # Orchestrateur unifié
│   │   ├── lovablePatternScanner.ts
│   │   ├── lovableCleanerEngine.ts
│   │   ├── astRefactor.ts
│   │   └── projectRebuilder.ts
│   └── pages/
├── backend/                      # Backend Express
│   └── src/
│       └── routes/
│           └── liberate.ts       # API de libération
├── supabase/
│   └── functions/                # 95+ Edge Functions
├── cli/                          # CLI Inopay
└── docker/                       # Configuration Docker
```

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine:

```env
# Supabase (auto-configuré avec Lovable Cloud)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxx

# Stripe (paiements)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# GitHub (export)
GITHUB_TOKEN=ghp_xxx

# Email (Resend)
RESEND_API_KEY=re_xxx
```

## 🚢 Déploiement

### Option 1: Lovable Cloud (Recommandé)

Cliquez sur **Publish** dans l'interface Lovable.

### Option 2: Self-Hosted (VPS)

```bash
# Sur votre VPS
curl -sSL https://inopay.dev/install.sh | bash

# Ou manuellement
docker-compose -f docker/docker-compose.sovereign.yml up -d
```

### Option 3: Coolify

1. Connectez votre serveur Coolify
2. Importez depuis GitHub
3. INOPAY détecte automatiquement le Dockerfile

## 📖 Documentation

- [Guide d'installation complet](./INSTALL.md)
- [Guide de migration](./MIGRATION_GUIDE.md)
- [Référence CLI](./docs/CLI_REFERENCE.md)
- [API Liberator](./docs/LIBERATOR_API.md)
- [Self-hosting](./docs/SELF_HOSTING.md)

## 🔒 Sécurité

- Authentification email avec OTP
- Row Level Security (RLS) sur toutes les tables
- Chiffrement des secrets utilisateur
- Rate limiting sur les API
- Protection CORS configurée

## 🛠️ Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Supabase Edge Functions, Express |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Paiements | Stripe |
| Déploiement | Docker, Coolify, Caddy |

## 📊 Métriques

- **95+ Edge Functions** déployées
- **34 tables** PostgreSQL avec RLS
- **Score de préparation**: 97%

## 🤝 Support

- Email: support@inopay.dev
- Documentation: https://docs.inopay.dev

---

© 2024 Inovaq Canada Inc. Tous droits réservés.
