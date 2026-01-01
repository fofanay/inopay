# Guide d'intégration Cloudflare pour Inopay

Ce guide explique comment configurer Cloudflare (gratuit) comme CDN/WAF devant Inopay pour une protection DDoS de niveau entreprise.

## 📋 Prérequis

- Un compte Cloudflare (gratuit sur [cloudflare.com](https://cloudflare.com))
- Un nom de domaine configuré
- Accès aux DNS de votre domaine

## 🚀 Installation

### Étape 1: Créer un compte Cloudflare

1. Rendez-vous sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Créez un compte ou connectez-vous
3. Cliquez sur "Add a Site"
4. Entrez votre nom de domaine

### Étape 2: Configurer les DNS

1. Cloudflare va scanner vos DNS existants
2. Vérifiez que tous les enregistrements sont corrects
3. Assurez-vous que le proxy Cloudflare (nuage orange) est activé pour:
   - `yourdomain.com` (A record)
   - `www.yourdomain.com` (CNAME ou A record)
   - `api.yourdomain.com` si applicable

### Étape 3: Mettre à jour les nameservers

1. Cloudflare vous donnera 2 nameservers (ex: `anna.ns.cloudflare.com`)
2. Allez dans le panneau de votre registrar de domaine
3. Remplacez les nameservers actuels par ceux de Cloudflare
4. Attendez la propagation (jusqu'à 24h, souvent quelques minutes)

## 🛡️ Configuration de la sécurité

### Niveau de sécurité de base

Dans **Security > Settings**:

```
Security Level: Medium (recommandé pour la production)
Challenge Passage: 30 minutes
Browser Integrity Check: ON
```

### Protection DDoS

Dans **Security > DDoS**:

- La protection DDoS L3/L4 est automatiquement activée
- La protection DDoS L7 est configurée par défaut

### Règles de pare-feu (WAF)

Dans **Security > WAF > Custom Rules**, créez ces règles:

#### Règle 1: Bloquer les pays à risque (optionnel)

```
Expression: (ip.geoip.country in {"CN" "RU" "KP"})
Action: Block
```

#### Règle 2: Protéger les endpoints d'API

```
Expression: (http.request.uri.path contains "/api/" and 
             http.request.method eq "POST" and 
             cf.threat_score gt 30)
Action: Challenge
```

#### Règle 3: Bloquer les user-agents suspects

```
Expression: (http.user_agent contains "sqlmap" or 
             http.user_agent contains "nikto" or 
             http.user_agent contains "nmap" or
             http.user_agent contains "masscan")
Action: Block
```

#### Règle 4: Protéger les paiements

```
Expression: (http.request.uri.path contains "/api/create-checkout" or
             http.request.uri.path contains "/api/stripe")
Action: Challenge (si cf.threat_score gt 10)
```

### Rate Limiting

Dans **Security > WAF > Rate Limiting Rules**:

#### Règle 1: API générale

```
Expression: (http.request.uri.path contains "/api/")
Rate: 100 requests per 1 minute
Action: Block for 1 hour
```

#### Règle 2: Authentification stricte

```
Expression: (http.request.uri.path contains "/api/send-otp" or
             http.request.uri.path contains "/api/verify-otp")
Rate: 5 requests per 15 minutes
Action: Block for 1 hour
```

#### Règle 3: Paiements

```
Expression: (http.request.uri.path contains "/api/create-checkout")
Rate: 10 requests per 1 minute
Action: Challenge
```

### Bot Management (Pro+)

Si vous avez un plan payant, dans **Security > Bots**:

```
Bot Fight Mode: ON
JavaScript Detections: ON
```

## 🔒 Configuration SSL/TLS

Dans **SSL/TLS**:

### Mode de chiffrement

```
SSL/TLS encryption mode: Full (strict)
```

### Certificat d'origine

1. Générez un certificat d'origine Cloudflare
2. Installez-le sur votre serveur
3. Configurez Nginx pour l'utiliser

### HSTS

Dans **SSL/TLS > Edge Certificates**:

```
Always Use HTTPS: ON
HTTP Strict Transport Security (HSTS): ON
  - Max Age: 12 months
  - Include subdomains: ON
  - Preload: ON
Minimum TLS Version: 1.2
```

## ⚡ Optimisation des performances

### Cache

Dans **Caching > Configuration**:

```
Caching Level: Standard
Browser Cache TTL: Respect Existing Headers
```

### Page Rules (pour les assets statiques)

Créez une Page Rule:

```
URL: *yourdomain.com/assets/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month
```

### Compression

Dans **Speed > Optimization**:

```
Auto Minify: JavaScript, CSS, HTML
Brotli: ON
Early Hints: ON
Rocket Loader: Test before enabling
```

## 📊 Monitoring

### Analytics

Dans **Analytics > Security**:

- Surveillez les menaces bloquées
- Identifiez les IPs suspectes
- Analysez les patterns d'attaque

### Alertes

Dans **Notifications**:

Configurez des alertes pour:
- Attaques DDoS détectées
- Pics de trafic anormaux
- Erreurs d'origine fréquentes

## 🔧 Configuration Nginx avec Cloudflare

Mettez à jour votre configuration Nginx pour:

### 1. Restaurer les vraies IPs

```nginx
# /etc/nginx/conf.d/cloudflare.conf

# IPs Cloudflare IPv4
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;

# IPs Cloudflare IPv6
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
```

### 2. Vérifier l'authenticité des requêtes Cloudflare

```nginx
# Vérifier que les requêtes viennent de Cloudflare
geo $realip_remote_addr $cloudflare {
    default 0;
    173.245.48.0/20 1;
    103.21.244.0/22 1;
    # ... (ajouter toutes les IPs Cloudflare)
}

# Bloquer les requêtes directes (bypass Cloudflare)
# server {
#     if ($cloudflare = 0) {
#         return 403;
#     }
# }
```

## ✅ Checklist de vérification

- [ ] Nameservers Cloudflare configurés
- [ ] SSL/TLS en mode Full (strict)
- [ ] HSTS activé
- [ ] Règles WAF configurées
- [ ] Rate limiting activé
- [ ] IPs réelles restaurées dans Nginx
- [ ] Alertes configurées
- [ ] Analytics surveillées

## 🆘 Dépannage

### Erreur 520-526

Ces erreurs indiquent un problème entre Cloudflare et votre serveur:

- **520**: Erreur inconnue - Vérifiez les logs de votre serveur
- **521**: Web server down - Votre serveur ne répond pas
- **522**: Connection timed out - Timeout de connexion
- **523**: Origin unreachable - Serveur inaccessible
- **524**: A timeout occurred - Timeout pendant le traitement
- **525**: SSL handshake failed - Problème de certificat
- **526**: Invalid SSL certificate - Certificat invalide

### En cas d'attaque DDoS

1. Activez "I'm Under Attack Mode" dans **Security > Settings**
2. Cela ajoutera un challenge JavaScript à toutes les requêtes
3. Désactivez une fois l'attaque terminée

## 📚 Ressources

- [Documentation Cloudflare](https://developers.cloudflare.com/)
- [Centre d'apprentissage Cloudflare](https://www.cloudflare.com/learning/)
- [Statut Cloudflare](https://www.cloudflarestatus.com/)
