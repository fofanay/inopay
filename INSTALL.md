# 🚀 Inopay - Guide de Libération & Déploiement

## Vision Simple

**Inopay libère votre code** des dépendances propriétaires Lovable/Bolt pour le déployer **n'importe où**.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UPLOAD    │ ──▶ │   ANALYSE   │ ──▶ │  DOWNLOAD   │
│ (ZIP/GitHub)│     │ (Détection) │     │ (ZIP prêt)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                         Déploiement MANUEL sur VPS/Coolify/etc.
```

---

## 📦 Contenu du ZIP Téléchargé

Après la libération, votre ZIP contient:

```
votre-projet-libre/
├── src/                    # Code source nettoyé
├── public/                 # Assets statiques
├── package.json            # Dépendances (sans propriétaires)
├── Dockerfile              # Build optimisé pour production
├── nginx.conf              # Configuration serveur web
└── README_INOPAY.md        # Ce guide de déploiement
```

---

## 🐳 Option 1: Docker (Recommandé)

### Déploiement en 2 commandes

```bash
# Build l'image
docker build -t mon-app .

# Lance le conteneur
docker run -d -p 80:80 --name mon-app mon-app
```

### Avec Docker Compose

Créez un fichier `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
```

Puis:

```bash
docker-compose up -d
```

---

## ☁️ Option 2: Coolify (Self-Hosted)

### Étapes manuelles

1. **Connectez-vous** à votre instance Coolify (ex: `http://votre-serveur:8000`)

2. **Créez un nouveau projet**
   - Cliquez sur "New Project"
   - Donnez un nom à votre projet

3. **Ajoutez une application**
   - Cliquez sur "+ New Resource" → "Application"
   - Sélectionnez "Docker" comme type de build

4. **Configurez la source**
   - Choisissez "GitHub" (public ou privé)
   - Entrez l'URL de votre dépôt
   - Ou utilisez "Direct Upload" si vous avez le ZIP

5. **Configuration du build**
   - Build Pack: `Dockerfile`
   - Dockerfile location: `Dockerfile` (à la racine)
   - Le Dockerfile inclus est déjà optimisé

6. **Domaine**
   - Ajoutez votre domaine personnalisé
   - Ou utilisez le domaine Coolify généré

7. **Déployez**
   - Cliquez sur "Deploy"
   - Attendez la fin du build

### Variables d'environnement (si nécessaire)

Si votre app nécessite des variables d'env, ajoutez-les dans:
- Coolify → Application → Environment Variables

Exemple:
```
VITE_API_URL=https://api.example.com
VITE_APP_NAME=MonApp
```

---

## 🖥️ Option 3: VPS Nu (Ubuntu/Debian)

### Prérequis

```bash
# Installer Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer nginx
sudo apt-get install -y nginx
```

### Déploiement

```bash
# Cloner/uploader votre projet
cd /var/www
git clone https://github.com/vous/votre-projet.git
cd votre-projet

# Installer et build
npm install
npm run build

# Copier les fichiers buildés
sudo cp -r dist/* /var/www/html/
sudo cp nginx.conf /etc/nginx/sites-available/default

# Redémarrer nginx
sudo nginx -t
sudo systemctl restart nginx
```

### Configuration nginx simplifiée

Si le `nginx.conf` inclus ne convient pas, utilisez:

```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public";
    }
}
```

---

## 🔧 Option 4: Autres Plateformes

### Vercel / Netlify

```bash
# Build standard
npm install
npm run build

# Puis drag & drop du dossier dist/
```

### GitHub Pages

1. Build localement
2. Push le dossier `dist/` sur une branche `gh-pages`
3. Activez GitHub Pages dans les settings

---

## ✅ Checklist Post-Déploiement

- [ ] L'app est accessible via HTTPS
- [ ] Les routes SPA fonctionnent (refresh sur /page ne donne pas 404)
- [ ] Les assets (images, fonts) se chargent
- [ ] Les variables d'environnement sont configurées
- [ ] Le cache est actif pour les assets statiques

---

## 🆘 Dépannage

### "Page blanche" ou erreur 404

→ Vérifiez que nginx/docker redirige vers `index.html` (SPA routing)

### "CORS errors"

→ Configurez les headers CORS sur votre API backend

### "Build failed" dans Coolify

→ Vérifiez que le Dockerfile est à la racine et que `package.json` est valide

### Assets ne se chargent pas

→ Vérifiez les chemins relatifs vs absolus dans votre code

---

## 📞 Support

- Documentation: https://docs.inopay.app
- Email: support@inopay.app

---

**Inopay** - Libérez votre code, déployez partout! 🚀
