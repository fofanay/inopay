# 🚀 Guide de Migration vers l'Autonomie Totale

Ce guide vous permettra de migrer Inopay de Lovable Cloud vers votre propre infrastructure.

## 📋 Prérequis

- Un compte [Supabase](https://supabase.com) (gratuit)
- Un compte [GitHub](https://github.com)
- Un VPS avec Coolify installé (optionnel, mais recommandé)
- Node.js 18+ et npm installés localement

## 🎯 Vue d'ensemble

### Dépendances actuelles

| Composant | Actuellement | Après migration |
|-----------|--------------|-----------------|
| Base de données | Lovable Cloud | Votre Supabase |
| Edge Functions | Lovable Cloud | Votre Supabase |
| Authentification | Lovable Cloud | Votre Supabase |
| Storage | Lovable Cloud | Votre Supabase |
| Code source | Lovable GitHub | Votre GitHub |
| Hébergement | Lovable Preview | Votre VPS/Coolify |

---

## 📦 Phase 1 : Créer votre instance Supabase

### 1.1 Créer le projet

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Cliquez sur **New Project**
3. Choisissez un nom (ex: `inopay-production`)
4. Sélectionnez une région proche de vos utilisateurs
5. Notez le mot de passe de la base de données

### 1.2 Récupérer les credentials

Dans **Settings > API**, notez :

```env
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

---

## 🗄️ Phase 2 : Migrer le schéma

### 2.1 Exporter le schéma actuel

Depuis le dashboard Inopay (connecté en admin), appelez :

```javascript
const { data } = await supabase.functions.invoke('export-schema');
console.log(data.sql);
```

Ou via l'interface admin, utilisez le bouton "Exporter le schéma".

### 2.2 Appliquer le schéma

1. Allez dans **SQL Editor** de votre nouveau Supabase
2. Collez le SQL exporté
3. Exécutez le script

### 2.3 Vérifier les tables

Vérifiez que toutes les tables sont créées :

- `admin_activity_logs`
- `banned_users`
- `deployment_history`
- `email_campaigns`
- `email_contacts`
- `email_list_contacts`
- `email_lists`
- `email_logs`
- `email_sends`
- `email_templates`
- `health_check_logs`
- `newsletter_subscribers`
- `projects_analysis`
- `security_audit_logs`
- `server_deployments`
- `subscriptions`
- `sync_configurations`
- `sync_history`
- `user_notifications`
- `user_purchases`
- `user_roles`
- `user_servers`
- `user_settings`

---

## ⚡ Phase 3 : Déployer les Edge Functions

### 3.1 Installer Supabase CLI

```bash
npm install -g supabase
```

### 3.2 Lier votre projet

```bash
supabase login
supabase link --project-ref [VOTRE_PROJECT_ID]
```

### 3.3 Déployer toutes les fonctions

```bash
supabase functions deploy --all
```

### Liste des 48 fonctions à déployer :

```
admin-list-payments
admin-list-subscriptions
admin-list-users
admin-manage-subscription
admin-manage-tester
auto-restart-container
check-deployment
check-server-status
check-subscription
clean-code
cleanup-coolify-orphans
cleanup-secrets
cleanup-storage
configure-database
convert-edge-to-backend
create-checkout
customer-portal
deploy-coolify
deploy-direct
deploy-ftp
diff-clean
export-schema
export-to-github
extract-rls-policies
fetch-github-repo
generate-archive
generate-docker-alternatives
get-user-credits
github-sync-webhook
health-monitor
list-github-repos
migrate-schema
provision-hetzner-vps
purge-server-deployments
rolling-update
send-email
send-liberation-report
send-newsletter-welcome
send-reminder-emails
serve-setup-script
setup-callback
setup-database
setup-vps
stripe-webhook
sync-coolify-status
use-credit
validate-coolify-token
widget-auth
```

---

## 🔐 Phase 4 : Configurer les secrets

### 4.1 Secrets requis

Dans **Edge Functions > Secrets**, ajoutez :

| Secret | Description | Où l'obtenir |
|--------|-------------|--------------|
| `STRIPE_SECRET_KEY` | Clé API Stripe | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe | Stripe > Webhooks |
| `RESEND_API_KEY` | Clé API Resend | [Resend Dashboard](https://resend.com/api-keys) |
| `ANTHROPIC_API_KEY` | Clé API Claude | [Anthropic Console](https://console.anthropic.com/) |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Token GitHub | GitHub > Settings > Developer settings |

### 4.2 Configurer le webhook Stripe

1. Allez sur [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Créez un endpoint : `https://[VOTRE_PROJECT].supabase.co/functions/v1/stripe-webhook`
3. Sélectionnez les événements :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copiez le **Signing Secret** dans `STRIPE_WEBHOOK_SECRET`

---

## 📤 Phase 5 : Migrer les données

### 5.1 Exporter depuis Lovable Cloud

Utilisez le SQL Editor ou la fonction d'export :

```sql
-- Exporter les utilisateurs et leurs données
COPY (SELECT * FROM user_settings) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM subscriptions) TO STDOUT WITH CSV HEADER;
COPY (SELECT * FROM user_servers) TO STDOUT WITH CSV HEADER;
-- etc.
```

### 5.2 Importer dans votre Supabase

```sql
-- Importer les données
COPY user_settings FROM '/path/to/user_settings.csv' WITH CSV HEADER;
-- etc.
```

---

## 🐙 Phase 6 : Créer votre repo GitHub

### 6.1 Via l'interface Inopay

1. Configurez votre token GitHub dans **Paramètres**
2. Utilisez la fonction **Exporter vers GitHub**
3. Choisissez un nom de repo (ex: `inopay`)

### 6.2 Manuellement

```bash
# Cloner depuis Lovable
git clone https://github.com/lovable-xyz/[VOTRE_PROJET].git inopay

# Changer le remote
cd inopay
git remote remove origin
git remote add origin https://github.com/[VOTRE_USERNAME]/inopay.git
git push -u origin main
```

---

## ⚙️ Phase 7 : Configuration finale

### 7.1 Créer le fichier .env.production

```env
# Supabase
VITE_SUPABASE_URL=https://[VOTRE_PROJECT].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[VOTRE_ANON_KEY]
VITE_SUPABASE_PROJECT_ID=[VOTRE_PROJECT_ID]

# Stripe (clés publiques uniquement)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### 7.2 Déployer sur Coolify

1. Connectez votre repo GitHub à Coolify
2. Configurez les variables d'environnement
3. Déployez !

### 7.3 Configurer le domaine

1. Ajoutez votre domaine dans Coolify
2. Configurez le DNS
3. SSL sera automatique via Let's Encrypt

---

## ✅ Checklist de vérification

- [ ] Nouveau projet Supabase créé
- [ ] Schéma de base de données migré
- [ ] Toutes les RLS policies en place
- [ ] 48 Edge Functions déployées
- [ ] Tous les secrets configurés
- [ ] Webhook Stripe configuré
- [ ] Données migrées (si applicable)
- [ ] Repo GitHub personnel créé
- [ ] Application déployée sur Coolify
- [ ] Domaine configuré et SSL actif
- [ ] Tests de bout en bout passés

---

## 🆘 Dépannage

### Les Edge Functions ne fonctionnent pas

```bash
# Vérifier les logs
supabase functions logs [FUNCTION_NAME]
```

### Erreurs de RLS

Vérifiez que la fonction `has_role` existe et que les types `app_role` sont créés.

### Problèmes d'authentification

Vérifiez que les URLs de redirection sont configurées dans **Authentication > URL Configuration**.

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs dans le dashboard Supabase
2. Consultez la documentation Supabase
3. Ouvrez une issue sur votre repo GitHub

---

**Félicitations !** 🎉 Vous êtes maintenant 100% autonome et propriétaire de votre infrastructure.
