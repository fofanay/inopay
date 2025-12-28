/**
 * Guide de Libération Complet - Ultra-détaillé pour Coolify + GitHub + Supabase Self-Hosted
 * Version 1.0
 */

export interface LiberationGuideConfig {
  projectName: string;
  hasBackend: boolean;
  hasDatabase: boolean;
  hasAuth: boolean;
  hasStorage: boolean;
  envVars: string[];
  backendRoutes: string[];
  webhooks: Array<{ provider: string; endpoint: string }>;
  schemaSQL?: string;
}

export function generateCompleteLiberationGuide(config: LiberationGuideConfig): string {
  const { projectName, hasBackend, hasDatabase, hasAuth, hasStorage, envVars, backendRoutes, webhooks, schemaSQL } = config;
  
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚀 Guide Complet de Libération - ${projectName}</title>
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-card: #334155;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --accent: #10b981;
      --accent-hover: #34d399;
      --warning: #f59e0b;
      --error: #ef4444;
      --info: #3b82f6;
      --border: #475569;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      padding: 40px 20px;
      background: linear-gradient(135deg, var(--bg-secondary), var(--bg-primary));
      border-bottom: 2px solid var(--accent);
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(90deg, var(--accent), var(--info));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: var(--bg-secondary);
      z-index: 1000;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--info));
      width: 0%;
      transition: width 0.3s;
    }
    
    .nav-sidebar {
      position: fixed;
      left: 0;
      top: 60px;
      width: 280px;
      height: calc(100vh - 60px);
      background: var(--bg-secondary);
      padding: 20px;
      overflow-y: auto;
      border-right: 1px solid var(--border);
    }
    
    .nav-sidebar h3 {
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      padding: 12px 15px;
      margin-bottom: 5px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
    }
    
    .nav-item:hover, .nav-item.active {
      background: var(--bg-card);
      color: var(--text-primary);
    }
    
    .nav-item.completed {
      color: var(--accent);
    }
    
    .nav-item .icon {
      margin-right: 10px;
      font-size: 1.2rem;
    }
    
    .nav-item .status {
      margin-left: auto;
      font-size: 0.8rem;
    }
    
    .main-content {
      margin-left: 300px;
      padding: 20px 40px;
    }
    
    .section {
      display: none;
      animation: fadeIn 0.3s ease;
    }
    
    .section.active {
      display: block;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .card {
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      border: 1px solid var(--border);
    }
    
    .card h2 {
      font-size: 1.5rem;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .card h3 {
      font-size: 1.2rem;
      margin: 20px 0 15px;
      color: var(--accent);
    }
    
    .step {
      background: var(--bg-card);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      border-left: 4px solid var(--border);
      transition: border-color 0.3s;
    }
    
    .step.completed {
      border-left-color: var(--accent);
    }
    
    .step.current {
      border-left-color: var(--info);
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
    }
    
    .step-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .step-number {
      width: 32px;
      height: 32px;
      background: var(--border);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 0.9rem;
    }
    
    .step.completed .step-number {
      background: var(--accent);
    }
    
    .step-title {
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    .code-block {
      background: #0d1117;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
      position: relative;
      overflow-x: auto;
    }
    
    .code-block pre {
      margin: 0;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 0.9rem;
      color: #e6edf3;
      white-space: pre-wrap;
      word-break: break-all;
    }
    
    .copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--bg-card);
      border: none;
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }
    
    .copy-btn:hover {
      background: var(--accent);
      color: white;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    
    .btn-primary:hover {
      background: var(--accent-hover);
      transform: translateY(-2px);
    }
    
    .btn-secondary {
      background: var(--bg-card);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    
    .btn-secondary:hover {
      background: var(--border);
    }
    
    .checkbox-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: var(--bg-card);
      border-radius: 8px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .checkbox-item:hover {
      background: var(--border);
    }
    
    .checkbox-item input {
      width: 20px;
      height: 20px;
      margin-top: 2px;
      accent-color: var(--accent);
    }
    
    .checkbox-item.checked {
      border: 1px solid var(--accent);
      background: rgba(16, 185, 129, 0.1);
    }
    
    .info-box {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid var(--info);
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .warning-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid var(--warning);
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .success-box {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid var(--accent);
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    
    .tabs {
      display: flex;
      gap: 5px;
      margin-bottom: 20px;
      border-bottom: 2px solid var(--border);
      padding-bottom: 5px;
    }
    
    .tab {
      padding: 10px 20px;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 8px 8px 0 0;
      transition: all 0.2s;
    }
    
    .tab.active {
      background: var(--bg-card);
      color: var(--accent);
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .screenshot {
      background: var(--bg-card);
      border: 2px dashed var(--border);
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      margin: 20px 0;
    }
    
    .screenshot-ascii {
      font-family: monospace;
      font-size: 0.85rem;
      text-align: left;
      white-space: pre;
      background: #0d1117;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      color: #7ee787;
    }
    
    .env-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    
    .env-table th, .env-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    
    .env-table th {
      background: var(--bg-card);
      font-weight: 600;
    }
    
    .env-table td code {
      background: #0d1117;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
    }
    
    .test-result {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 15px;
      background: var(--bg-card);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    .test-result.success { border-left: 3px solid var(--accent); }
    .test-result.error { border-left: 3px solid var(--error); }
    .test-result.pending { border-left: 3px solid var(--warning); }
    
    .floating-actions {
      position: fixed;
      bottom: 30px;
      right: 30px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    
    @media (max-width: 900px) {
      .nav-sidebar {
        display: none;
      }
      .main-content {
        margin-left: 0;
        padding: 15px;
      }
    }
    
    .accordion {
      margin: 15px 0;
    }
    
    .accordion-header {
      background: var(--bg-card);
      padding: 15px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .accordion-content {
      display: none;
      padding: 20px;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 8px 8px;
    }
    
    .accordion.open .accordion-content {
      display: block;
    }
    
    .accordion.open .accordion-header {
      border-radius: 8px 8px 0 0;
    }
  </style>
</head>
<body>
  <div class="progress-bar">
    <div class="progress-fill" id="progressFill"></div>
  </div>
  
  <nav class="nav-sidebar">
    <h3>📋 Étapes de Libération</h3>
    <div class="nav-item active" data-section="prerequisites" onclick="showSection('prerequisites')">
      <span class="icon">✓</span>
      <span>1. Prérequis</span>
      <span class="status" id="status-prerequisites">⏳</span>
    </div>
    <div class="nav-item" data-section="transfer" onclick="showSection('transfer')">
      <span class="icon">📁</span>
      <span>2. Transfert Fichiers</span>
      <span class="status" id="status-transfer">⏳</span>
    </div>
    <div class="nav-item" data-section="github" onclick="showSection('github')">
      <span class="icon">🐙</span>
      <span>3. Configuration GitHub</span>
      <span class="status" id="status-github">⏳</span>
    </div>
    <div class="nav-item" data-section="coolify" onclick="showSection('coolify')">
      <span class="icon">🚀</span>
      <span>4. Déploiement Coolify</span>
      <span class="status" id="status-coolify">⏳</span>
    </div>
    <div class="nav-item" data-section="supabase" onclick="showSection('supabase')">
      <span class="icon">🗄️</span>
      <span>5. Supabase Self-Hosted</span>
      <span class="status" id="status-supabase">⏳</span>
    </div>
    <div class="nav-item" data-section="database" onclick="showSection('database')">
      <span class="icon">💾</span>
      <span>6. Migration Base de Données</span>
      <span class="status" id="status-database">⏳</span>
    </div>
    <div class="nav-item" data-section="domain" onclick="showSection('domain')">
      <span class="icon">🌐</span>
      <span>7. Configuration Domaine</span>
      <span class="status" id="status-domain">⏳</span>
    </div>
    <div class="nav-item" data-section="verification" onclick="showSection('verification')">
      <span class="icon">🔍</span>
      <span>8. Vérification Finale</span>
      <span class="status" id="status-verification">⏳</span>
    </div>
  </nav>
  
  <main class="main-content">
    <!-- Section 1: Prérequis -->
    <section class="section active" id="section-prerequisites">
      <div class="card">
        <h2>✓ Étape 1 : Vérification des Prérequis</h2>
        <p>Avant de commencer, assurez-vous d'avoir tous les éléments nécessaires.</p>
        
        <h3>🖥️ Serveur VPS</h3>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox" id="check-vps">
          <div>
            <strong>VPS avec accès root</strong>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 5px;">
              Minimum recommandé: 2 vCPU, 4GB RAM, 40GB SSD<br>
              Fournisseurs: Hetzner, OVH, DigitalOcean, Scaleway
            </p>
          </div>
        </div>
        
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox" id="check-coolify">
          <div>
            <strong>Coolify installé sur le VPS</strong>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 5px;">
              Si non installé, exécutez cette commande:
            </p>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre>curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash</pre>
            </div>
          </div>
        </div>
        
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox" id="check-domain">
          <div>
            <strong>Nom de domaine (optionnel mais recommandé)</strong>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 5px;">
              Configuré pour pointer vers l'IP de votre VPS
            </p>
          </div>
        </div>
        
        <h3>🔐 Accès SSH</h3>
        <div class="step">
          <div class="step-header">
            <span class="step-number">1</span>
            <span class="step-title">Testez votre connexion SSH</span>
          </div>
          <div class="code-block">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
            <pre>ssh root@VOTRE_IP_VPS</pre>
          </div>
          <p>Remplacez <code>VOTRE_IP_VPS</code> par l'IP de votre serveur.</p>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">2</span>
            <span class="step-title">Vérifiez Docker</span>
          </div>
          <div class="code-block">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
            <pre>docker --version && docker compose version</pre>
          </div>
          <p>Vous devriez voir les versions de Docker et Docker Compose.</p>
        </div>
        
        <h3>📦 Outils locaux</h3>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox" id="check-git">
          <div>
            <strong>Git installé localement</strong>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre>git --version</pre>
            </div>
          </div>
        </div>
        
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox" id="check-github">
          <div>
            <strong>Compte GitHub</strong>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 5px;">
              Pour héberger votre code et déclencher les déploiements
            </p>
          </div>
        </div>
        
        <div class="info-box">
          <strong>💡 Note:</strong> Coolify gère automatiquement SSL/HTTPS, les mises à jour et le monitoring.
        </div>
        
        <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" onclick="completeSection('prerequisites'); showSection('transfer');">
            Continuer → Transfert des Fichiers
          </button>
        </div>
      </div>
    </section>
    
    <!-- Section 2: Transfert des Fichiers -->
    <section class="section" id="section-transfer">
      <div class="card">
        <h2>📁 Étape 2 : Transfert des Fichiers vers le VPS</h2>
        <p>Plusieurs méthodes sont disponibles. Choisissez celle qui vous convient.</p>
        
        <div class="tabs">
          <button class="tab active" onclick="showTab('transfer', 'github-method')">🐙 Via GitHub (Recommandé)</button>
          <button class="tab" onclick="showTab('transfer', 'scp-method')">💻 Via SCP</button>
          <button class="tab" onclick="showTab('transfer', 'sftp-method')">📂 Via SFTP</button>
        </div>
        
        <div class="tab-content active" id="transfer-github-method">
          <h3>Méthode GitHub (Recommandée)</h3>
          <p>Cette méthode permet à Coolify de déployer automatiquement à chaque push.</p>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Créez un nouveau dépôt GitHub</span>
            </div>
            <ol style="margin-left: 20px; margin-top: 10px;">
              <li>Allez sur <a href="https://github.com/new" target="_blank" style="color: var(--accent);">github.com/new</a></li>
              <li>Nom du dépôt: <code>${projectName}-liberated</code></li>
              <li>Choisissez <strong>Private</strong> (recommandé)</li>
              <li>Ne cochez PAS "Add README" ou autres options</li>
              <li>Cliquez <strong>Create repository</strong></li>
            </ol>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">2</span>
              <span class="step-title">Initialisez le dépôt local</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre># Ouvrez un terminal dans le dossier du Liberation Pack
cd ${projectName}

# Initialisez Git
git init
git add .
git commit -m "🚀 Initial liberation - ${projectName}"

# Connectez à GitHub (remplacez VOTRE_USERNAME)
git remote add origin https://github.com/VOTRE_USERNAME/${projectName}-liberated.git
git branch -M main
git push -u origin main</pre>
            </div>
          </div>
          
          <div class="success-box">
            <strong>✅ Résultat:</strong> Votre code est maintenant sur GitHub et prêt à être déployé par Coolify.
          </div>
        </div>
        
        <div class="tab-content" id="transfer-scp-method">
          <h3>Méthode SCP (Ligne de commande)</h3>
          <p>Transfert direct vers le VPS via SSH.</p>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Transférez le dossier complet</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre># Depuis votre machine locale, dans le dossier parent du Liberation Pack
scp -r ${projectName} root@VOTRE_IP:/opt/apps/</pre>
            </div>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">2</span>
              <span class="step-title">Vérifiez le transfert</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre>ssh root@VOTRE_IP "ls -la /opt/apps/${projectName}"</pre>
            </div>
          </div>
        </div>
        
        <div class="tab-content" id="transfer-sftp-method">
          <h3>Méthode SFTP (Interface graphique)</h3>
          <p>Utilisez FileZilla, Cyberduck ou WinSCP pour un transfert visuel.</p>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Configurez la connexion</span>
            </div>
            <table class="env-table">
              <tr><th>Paramètre</th><th>Valeur</th></tr>
              <tr><td>Protocole</td><td><code>SFTP</code></td></tr>
              <tr><td>Hôte</td><td><code>VOTRE_IP_VPS</code></td></tr>
              <tr><td>Port</td><td><code>22</code></td></tr>
              <tr><td>Utilisateur</td><td><code>root</code></td></tr>
              <tr><td>Auth</td><td>Clé SSH ou mot de passe</td></tr>
            </table>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">2</span>
              <span class="step-title">Transférez vers /opt/apps/</span>
            </div>
            <p>Glissez-déposez le dossier <code>${projectName}</code> vers <code>/opt/apps/</code> sur le serveur.</p>
          </div>
        </div>
        
        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="showSection('prerequisites')">
            ← Retour
          </button>
          <button class="btn btn-primary" onclick="completeSection('transfer'); showSection('github');">
            Continuer → Configuration GitHub
          </button>
        </div>
      </div>
    </section>
    
    <!-- Section 3: Configuration GitHub -->
    <section class="section" id="section-github">
      <div class="card">
        <h2>🐙 Étape 3 : Configuration GitHub pour Coolify</h2>
        <p>Connectez votre dépôt GitHub à Coolify pour des déploiements automatiques.</p>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">1</span>
            <span class="step-title">Accédez à Coolify</span>
          </div>
          <div class="code-block">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
            <pre>https://VOTRE_IP:8000</pre>
          </div>
          <p>Ou si vous avez configuré un domaine: <code>https://coolify.votre-domaine.com</code></p>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">2</span>
            <span class="step-title">Connectez GitHub à Coolify</span>
          </div>
          <div class="screenshot-ascii">
┌─────────────────────────────────────────────────────────────┐
│  COOLIFY - Settings > Git Sources                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🐙 GitHub                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [+ Add GitHub App]                                  │    │
│  │                                                     │    │
│  │ 1. Cliquez sur "Add GitHub App"                     │    │
│  │ 2. Autorisez Coolify sur votre compte GitHub        │    │
│  │ 3. Sélectionnez le dépôt ${projectName}-liberated       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘</div>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">3</span>
            <span class="step-title">Créez un Personal Access Token (alternative)</span>
          </div>
          <p>Si vous préférez utiliser un token:</p>
          <ol style="margin-left: 20px; margin-top: 10px;">
            <li>Allez sur <a href="https://github.com/settings/tokens" target="_blank" style="color: var(--accent);">GitHub Settings > Tokens</a></li>
            <li>Cliquez <strong>Generate new token (classic)</strong></li>
            <li>Cochez: <code>repo</code>, <code>read:packages</code>, <code>workflow</code></li>
            <li>Générez et copiez le token</li>
          </ol>
        </div>
        
        <div class="info-box">
          <strong>💡 Déploiement automatique:</strong> Une fois connecté, chaque <code>git push</code> déclenchera automatiquement un nouveau déploiement.
        </div>
        
        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="showSection('transfer')">
            ← Retour
          </button>
          <button class="btn btn-primary" onclick="completeSection('github'); showSection('coolify');">
            Continuer → Déploiement Coolify
          </button>
        </div>
      </div>
    </section>
    
    <!-- Section 4: Déploiement Coolify -->
    <section class="section" id="section-coolify">
      <div class="card">
        <h2>🚀 Étape 4 : Déploiement avec Coolify</h2>
        <p>Créez et configurez votre application dans Coolify.</p>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">1</span>
            <span class="step-title">Créez un nouveau projet</span>
          </div>
          <div class="screenshot-ascii">
┌─────────────────────────────────────────────────────────────┐
│  COOLIFY - Dashboard                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [+ New Project]  ← Cliquez ici                             │
│                                                             │
│  Nom: ${projectName}                                            │
│  Description: Application libérée par InoPay               │
│                                                             │
│  [Create Project]                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘</div>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">2</span>
            <span class="step-title">Ajoutez une ressource (Application)</span>
          </div>
          <ol style="margin-left: 20px; margin-top: 10px;">
            <li>Dans votre projet, cliquez <strong>+ New Resource</strong></li>
            <li>Sélectionnez <strong>Docker Compose</strong></li>
            <li>Choisissez <strong>GitHub</strong> comme source</li>
            <li>Sélectionnez votre dépôt <code>${projectName}-liberated</code></li>
            <li>Branche: <code>main</code></li>
          </ol>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">3</span>
            <span class="step-title">Configurez les variables d'environnement</span>
          </div>
          <p>Dans <strong>Settings > Environment Variables</strong>, ajoutez:</p>
          <table class="env-table">
            <tr><th>Variable</th><th>Valeur</th><th>Description</th></tr>
            ${envVars.map(v => `<tr><td><code>${v}</code></td><td><input type="text" placeholder="..." style="background: var(--bg-card); border: 1px solid var(--border); padding: 5px; border-radius: 4px; color: var(--text-primary); width: 150px;"></td><td>À configurer</td></tr>`).join('')}
          </table>
          
          <div class="warning-box">
            <strong>⚠️ Important:</strong> Ne commitez jamais les vraies valeurs de ces variables dans Git. Configurez-les uniquement dans Coolify.
          </div>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">4</span>
            <span class="step-title">Lancez le déploiement</span>
          </div>
          <div class="screenshot-ascii">
┌─────────────────────────────────────────────────────────────┐
│  COOLIFY - Application Settings                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ⏳ Building...                                      │
│                                                             │
│  [Deploy]  [Restart]  [Stop]                               │
│                                                             │
│  Build Logs:                                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Step 1/8 : FROM node:20-alpine AS builder          │    │
│  │ Step 2/8 : WORKDIR /app                            │    │
│  │ Step 3/8 : COPY package*.json ./                   │    │
│  │ ...                                                 │    │
│  │ ✓ Successfully built                                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘</div>
          <p>Le build prend généralement 2-5 minutes. Surveillez les logs pour tout problème.</p>
        </div>
        
        <div class="success-box">
          <strong>✅ Résultat attendu:</strong> Votre application frontend devrait être accessible sur l'URL fournie par Coolify.
        </div>
        
        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="showSection('github')">
            ← Retour
          </button>
          <button class="btn btn-primary" onclick="completeSection('coolify'); showSection('supabase');">
            Continuer → Supabase Self-Hosted
          </button>
        </div>
      </div>
    </section>
    
    <!-- Section 5: Supabase Self-Hosted -->
    <section class="section" id="section-supabase">
      <div class="card">
        <h2>🗄️ Étape 5 : Installation Supabase Self-Hosted</h2>
        <p>Installez votre propre instance Supabase pour remplacer le service cloud.</p>
        
        <div class="tabs">
          <button class="tab active" onclick="showTab('supabase', 'docker-compose')">🐳 Docker Compose (Recommandé)</button>
          <button class="tab" onclick="showTab('supabase', 'coolify-native')">🚀 Via Coolify</button>
        </div>
        
        <div class="tab-content active" id="supabase-docker-compose">
          <h3>Installation via Docker Compose</h3>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Téléchargez Supabase Self-Hosted</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre># Sur votre VPS
cd /opt
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copiez le fichier de configuration
cp .env.example .env</pre>
            </div>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">2</span>
              <span class="step-title">Générez les secrets</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre># Générez un JWT secret (gardez-le précieusement!)
openssl rand -base64 32

# Générez les clés anon et service_role avec:
# https://supabase.com/docs/guides/self-hosting#generating-api-keys</pre>
            </div>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">3</span>
              <span class="step-title">Configurez le fichier .env</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre># Éditez /opt/supabase/docker/.env
nano /opt/supabase/docker/.env

# Modifiez ces valeurs:
POSTGRES_PASSWORD=votre_mot_de_passe_securise
JWT_SECRET=votre_jwt_secret_genere
ANON_KEY=votre_cle_anon
SERVICE_ROLE_KEY=votre_cle_service_role
SITE_URL=https://votre-domaine.com
API_EXTERNAL_URL=https://api.votre-domaine.com</pre>
            </div>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">4</span>
              <span class="step-title">Démarrez Supabase</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre>cd /opt/supabase/docker
docker compose up -d

# Vérifiez que tout fonctionne
docker compose ps</pre>
            </div>
            <p>Tous les services doivent être en état "Up".</p>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">5</span>
              <span class="step-title">Accédez à Supabase Studio</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre>http://VOTRE_IP:3000</pre>
            </div>
            <p>C'est l'interface d'administration de votre Supabase self-hosted.</p>
          </div>
        </div>
        
        <div class="tab-content" id="supabase-coolify-native">
          <h3>Installation via Coolify (One-Click)</h3>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Accédez à l'App Store Coolify</span>
            </div>
            <ol style="margin-left: 20px; margin-top: 10px;">
              <li>Dans Coolify, allez dans <strong>+ New Resource</strong></li>
              <li>Sélectionnez <strong>Services</strong></li>
              <li>Cherchez <strong>Supabase</strong></li>
              <li>Cliquez <strong>Deploy</strong></li>
            </ol>
          </div>
          
          <div class="info-box">
            <strong>💡 Avantage:</strong> Coolify génère automatiquement les secrets et configure les domaines.
          </div>
        </div>
        
        <h3>📋 Informations à noter</h3>
        <table class="env-table">
          <tr><th>Service</th><th>URL</th><th>Usage</th></tr>
          <tr><td>Studio</td><td><code>http://IP:3000</code></td><td>Interface d'administration</td></tr>
          <tr><td>API</td><td><code>http://IP:8000</code></td><td>Point d'entrée API</td></tr>
          <tr><td>PostgreSQL</td><td><code>IP:5432</code></td><td>Base de données</td></tr>
          <tr><td>Auth</td><td><code>http://IP:9999</code></td><td>Service d'authentification</td></tr>
        </table>
        
        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="showSection('coolify')">
            ← Retour
          </button>
          <button class="btn btn-primary" onclick="completeSection('supabase'); showSection('database');">
            Continuer → Migration BDD
          </button>
        </div>
      </div>
    </section>
    
    <!-- Section 6: Migration Base de Données -->
    <section class="section" id="section-database">
      <div class="card">
        <h2>💾 Étape 6 : Migration de la Base de Données</h2>
        <p>Importez votre schéma de base de données dans Supabase Self-Hosted.</p>
        
        ${hasDatabase ? `
        <div class="step">
          <div class="step-header">
            <span class="step-number">1</span>
            <span class="step-title">Localisez le fichier de schéma</span>
          </div>
          <p>Le schéma SQL se trouve dans:</p>
          <div class="code-block">
            <pre>database/migrations/001_schema.sql</pre>
          </div>
        </div>
        
        <div class="tabs">
          <button class="tab active" onclick="showTab('db', 'studio')">🎨 Via Studio (Visuel)</button>
          <button class="tab" onclick="showTab('db', 'cli')">💻 Via CLI</button>
        </div>
        
        <div class="tab-content active" id="db-studio">
          <div class="step">
            <div class="step-header">
              <span class="step-number">2</span>
              <span class="step-title">Ouvrez Supabase Studio</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre>http://VOTRE_IP:3000</pre>
            </div>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">3</span>
              <span class="step-title">Exécutez le SQL</span>
            </div>
            <div class="screenshot-ascii">
┌─────────────────────────────────────────────────────────────┐
│  SUPABASE STUDIO - SQL Editor                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Cliquez sur "SQL Editor" dans le menu                  │
│  2. Cliquez sur "+ New Query"                              │
│  3. Collez le contenu de 001_schema.sql                    │
│  4. Cliquez sur "Run" (ou Ctrl+Enter)                      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ -- Contenu de database/migrations/001_schema.sql   │    │
│  │ CREATE TABLE ...                                    │    │
│  │ ...                                                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  [▶ Run]                                                    │
│                                                             │
│  ✓ Success. 12 rows affected.                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘</div>
          </div>
        </div>
        
        <div class="tab-content" id="db-cli">
          <div class="step">
            <div class="step-header">
              <span class="step-number">2</span>
              <span class="step-title">Connectez-vous via psql</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre># Sur votre VPS
docker exec -it supabase-db psql -U postgres

# Ou depuis votre machine locale
psql "postgresql://postgres:VOTRE_PASSWORD@VOTRE_IP:5432/postgres"</pre>
            </div>
          </div>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">3</span>
              <span class="step-title">Importez le schéma</span>
            </div>
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
              <pre># Si le fichier est sur le serveur
psql -U postgres -d postgres -f /opt/apps/${projectName}/database/migrations/001_schema.sql

# Ou exécutez directement dans psql:
\\i /chemin/vers/001_schema.sql</pre>
            </div>
          </div>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">4</span>
            <span class="step-title">Vérifiez les tables créées</span>
          </div>
          <div class="code-block">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
            <pre>-- Dans SQL Editor ou psql
\\dt public.*

-- Ou
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';</pre>
          </div>
        </div>
        ` : `
        <div class="info-box">
          <strong>ℹ️ Pas de base de données:</strong> Ce projet ne nécessite pas de migration de base de données.
        </div>
        `}
        
        ${hasAuth ? `
        <h3>🔐 Configuration de l'authentification</h3>
        <div class="step">
          <div class="step-header">
            <span class="step-number">5</span>
            <span class="step-title">Configurez l'authentification</span>
          </div>
          <p>Dans Supabase Studio > Authentication > Settings:</p>
          <ul style="margin-left: 20px; margin-top: 10px;">
            <li>Site URL: <code>https://votre-domaine.com</code></li>
            <li>Redirect URLs: <code>https://votre-domaine.com/*</code></li>
          </ul>
        </div>
        ` : ''}
        
        <div class="success-box">
          <strong>✅ Vérification:</strong> Allez dans Studio > Table Editor pour voir vos tables créées.
        </div>
        
        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="showSection('supabase')">
            ← Retour
          </button>
          <button class="btn btn-primary" onclick="completeSection('database'); showSection('domain');">
            Continuer → Configuration Domaine
          </button>
        </div>
      </div>
    </section>
    
    <!-- Section 7: Configuration Domaine -->
    <section class="section" id="section-domain">
      <div class="card">
        <h2>🌐 Étape 7 : Configuration du Nom de Domaine</h2>
        <p>Configurez votre domaine pour pointer vers votre application.</p>
        
        <div class="tabs">
          <button class="tab active" onclick="showTab('domain', 'cloudflare')">☁️ Cloudflare</button>
          <button class="tab" onclick="showTab('domain', 'ovh')">🇫🇷 OVH</button>
          <button class="tab" onclick="showTab('domain', 'gandi')">🌍 Gandi</button>
          <button class="tab" onclick="showTab('domain', 'other')">Autre</button>
        </div>
        
        <div class="tab-content active" id="domain-cloudflare">
          <h3>Configuration Cloudflare</h3>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Ajoutez les enregistrements DNS</span>
            </div>
            <p>Dans Cloudflare Dashboard > DNS > Records:</p>
            <table class="env-table">
              <tr><th>Type</th><th>Nom</th><th>Contenu</th><th>Proxy</th></tr>
              <tr><td>A</td><td><code>@</code></td><td><code>VOTRE_IP_VPS</code></td><td>DNS only (⚪)</td></tr>
              <tr><td>A</td><td><code>api</code></td><td><code>VOTRE_IP_VPS</code></td><td>DNS only (⚪)</td></tr>
              <tr><td>A</td><td><code>studio</code></td><td><code>VOTRE_IP_VPS</code></td><td>DNS only (⚪)</td></tr>
            </table>
            
            <div class="warning-box">
              <strong>⚠️ Important:</strong> Désactivez le proxy Cloudflare (nuage gris) pour permettre à Coolify de gérer le SSL.
            </div>
          </div>
        </div>
        
        <div class="tab-content" id="domain-ovh">
          <h3>Configuration OVH</h3>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Accédez à la zone DNS</span>
            </div>
            <p>Dans OVH Manager > Web > Domaines > votre-domaine > Zone DNS:</p>
            <table class="env-table">
              <tr><th>Type</th><th>Sous-domaine</th><th>Cible</th><th>TTL</th></tr>
              <tr><td>A</td><td>(vide)</td><td><code>VOTRE_IP_VPS</code></td><td>3600</td></tr>
              <tr><td>A</td><td>api</td><td><code>VOTRE_IP_VPS</code></td><td>3600</td></tr>
              <tr><td>A</td><td>studio</td><td><code>VOTRE_IP_VPS</code></td><td>3600</td></tr>
            </table>
          </div>
        </div>
        
        <div class="tab-content" id="domain-gandi">
          <h3>Configuration Gandi</h3>
          
          <div class="step">
            <div class="step-header">
              <span class="step-number">1</span>
              <span class="step-title">Modifiez la zone DNS</span>
            </div>
            <p>Dans Gandi > Nom de domaine > votre-domaine > Enregistrements DNS:</p>
            <table class="env-table">
              <tr><th>Type</th><th>Nom</th><th>Valeur</th></tr>
              <tr><td>A</td><td>@</td><td><code>VOTRE_IP_VPS</code></td></tr>
              <tr><td>A</td><td>api</td><td><code>VOTRE_IP_VPS</code></td></tr>
              <tr><td>A</td><td>studio</td><td><code>VOTRE_IP_VPS</code></td></tr>
            </table>
          </div>
        </div>
        
        <div class="tab-content" id="domain-other">
          <h3>Configuration Générale</h3>
          <p>Chez votre registrar, ajoutez ces enregistrements:</p>
          <table class="env-table">
            <tr><th>Type</th><th>Nom</th><th>Valeur</th><th>Usage</th></tr>
            <tr><td>A</td><td>@ ou domaine.com</td><td>IP du VPS</td><td>Site principal</td></tr>
            <tr><td>A</td><td>api</td><td>IP du VPS</td><td>API Supabase</td></tr>
            <tr><td>A</td><td>studio</td><td>IP du VPS</td><td>Supabase Studio</td></tr>
          </table>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">2</span>
            <span class="step-title">Configurez Coolify pour le domaine</span>
          </div>
          <div class="screenshot-ascii">
┌─────────────────────────────────────────────────────────────┐
│  COOLIFY - Application Settings                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Domains:                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ https://votre-domaine.com                           │    │
│  │ [+ Add Domain]                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  SSL: [✓] Auto (Let's Encrypt)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘</div>
          <p>Coolify générera automatiquement un certificat SSL Let's Encrypt.</p>
        </div>
        
        <div class="step">
          <div class="step-header">
            <span class="step-number">3</span>
            <span class="step-title">Vérifiez la propagation DNS</span>
          </div>
          <div class="code-block">
            <button class="copy-btn" onclick="copyCode(this)">📋 Copier</button>
            <pre># Testez la résolution DNS
nslookup votre-domaine.com
dig votre-domaine.com

# Ou utilisez un outil en ligne:
# https://dnschecker.org</pre>
          </div>
          <p>La propagation peut prendre jusqu'à 24-48h, mais généralement c'est en quelques minutes.</p>
        </div>
        
        <div class="success-box">
          <strong>✅ Résultat:</strong> Votre application est accessible sur <code>https://votre-domaine.com</code>
        </div>
        
        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="showSection('database')">
            ← Retour
          </button>
          <button class="btn btn-primary" onclick="completeSection('domain'); showSection('verification');">
            Continuer → Vérification Finale
          </button>
        </div>
      </div>
    </section>
    
    <!-- Section 8: Vérification Finale -->
    <section class="section" id="section-verification">
      <div class="card">
        <h2>🔍 Étape 8 : Vérification Finale</h2>
        <p>Testez que tous les services fonctionnent correctement.</p>
        
        <h3>🧪 Tests Automatiques</h3>
        <div id="test-results">
          <div class="test-result pending" id="test-frontend">
            <span>⏳</span>
            <span>Frontend</span>
            <span style="margin-left: auto; color: var(--text-secondary);">Non testé</span>
          </div>
          ${hasBackend ? `
          <div class="test-result pending" id="test-api">
            <span>⏳</span>
            <span>API Backend</span>
            <span style="margin-left: auto; color: var(--text-secondary);">Non testé</span>
          </div>
          ` : ''}
          ${hasDatabase ? `
          <div class="test-result pending" id="test-database">
            <span>⏳</span>
            <span>Base de Données</span>
            <span style="margin-left: auto; color: var(--text-secondary);">Non testé</span>
          </div>
          ` : ''}
          ${hasAuth ? `
          <div class="test-result pending" id="test-auth">
            <span>⏳</span>
            <span>Authentification</span>
            <span style="margin-left: auto; color: var(--text-secondary);">Non testé</span>
          </div>
          ` : ''}
          ${hasStorage ? `
          <div class="test-result pending" id="test-storage">
            <span>⏳</span>
            <span>Stockage</span>
            <span style="margin-left: auto; color: var(--text-secondary);">Non testé</span>
          </div>
          ` : ''}
        </div>
        
        <div style="margin: 20px 0;">
          <label style="display: block; margin-bottom: 10px;">URL de votre application:</label>
          <input type="text" id="app-url" placeholder="https://votre-domaine.com" 
                 style="width: 100%; padding: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 1rem;">
        </div>
        
        <button class="btn btn-primary" onclick="runAllTests()" style="width: 100%; margin-bottom: 20px;">
          🚀 Lancer tous les tests
        </button>
        
        ${webhooks.length > 0 ? `
        <h3>🔗 Reconfiguration des Webhooks</h3>
        <p>N'oubliez pas de mettre à jour vos webhooks avec les nouvelles URLs:</p>
        <table class="env-table">
          <tr><th>Service</th><th>Ancienne URL</th><th>Nouvelle URL</th></tr>
          ${webhooks.map(w => `<tr>
            <td>${w.provider}</td>
            <td><code style="font-size: 0.8rem;">${w.endpoint}</code></td>
            <td><code style="font-size: 0.8rem;">https://api.VOTRE_DOMAINE/backend${w.endpoint}</code></td>
          </tr>`).join('')}
        </table>
        ` : ''}
        
        <h3>📋 Checklist Finale</h3>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox">
          <span>L'application s'affiche correctement</span>
        </div>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox">
          <span>L'authentification fonctionne (inscription/connexion)</span>
        </div>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox">
          <span>Les données sont sauvegardées en base</span>
        </div>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox">
          <span>Le SSL est actif (cadenas vert)</span>
        </div>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox">
          <span>Les webhooks sont reconfigurés</span>
        </div>
        <div class="checkbox-item" onclick="toggleCheck(this)">
          <input type="checkbox">
          <span>Backup de la base de données configuré</span>
        </div>
        
        <div id="completion-message" style="display: none;">
          <div class="success-box" style="margin-top: 30px; text-align: center;">
            <h2 style="color: var(--accent); margin-bottom: 10px;">🎉 Félicitations !</h2>
            <p style="font-size: 1.2rem;">Votre application ${projectName} est maintenant 100% souveraine !</p>
            <p style="margin-top: 15px; color: var(--text-secondary);">
              Plus aucune dépendance aux services cloud propriétaires.<br>
              Vous avez le contrôle total de vos données et de votre infrastructure.
            </p>
          </div>
        </div>
        
        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <button class="btn btn-secondary" onclick="showSection('domain')">
            ← Retour
          </button>
          <button class="btn btn-primary" onclick="completeSection('verification'); showCompletionMessage();">
            ✅ Terminer la Libération
          </button>
        </div>
      </div>
    </section>
  </main>
  
  <div class="floating-actions">
    <button class="btn btn-secondary" onclick="exportReport()">📄 Exporter Rapport</button>
    <button class="btn btn-secondary" onclick="window.print()">🖨️ Imprimer</button>
  </div>
  
  <script>
    // State management
    const state = {
      completedSections: [],
      currentSection: 'prerequisites',
      testResults: {}
    };
    
    // Load saved state
    const savedState = localStorage.getItem('liberation-guide-state');
    if (savedState) {
      Object.assign(state, JSON.parse(savedState));
      // Restore UI state
      state.completedSections.forEach(s => {
        document.getElementById('status-' + s).textContent = '✅';
        document.querySelector('[data-section="' + s + '"]').classList.add('completed');
      });
    }
    
    function saveState() {
      localStorage.setItem('liberation-guide-state', JSON.stringify(state));
    }
    
    function showSection(sectionId) {
      // Hide all sections
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      
      // Show target section
      document.getElementById('section-' + sectionId).classList.add('active');
      document.querySelector('[data-section="' + sectionId + '"]').classList.add('active');
      
      state.currentSection = sectionId;
      updateProgress();
    }
    
    function completeSection(sectionId) {
      if (!state.completedSections.includes(sectionId)) {
        state.completedSections.push(sectionId);
      }
      document.getElementById('status-' + sectionId).textContent = '✅';
      document.querySelector('[data-section="' + sectionId + '"]').classList.add('completed');
      saveState();
      updateProgress();
    }
    
    function updateProgress() {
      const totalSections = 8;
      const progress = (state.completedSections.length / totalSections) * 100;
      document.getElementById('progressFill').style.width = progress + '%';
    }
    
    function showTab(section, tabId) {
      const tabButtons = document.querySelectorAll('#section-' + section + ' .tab');
      const tabContents = document.querySelectorAll('#section-' + section + ' .tab-content');
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById(section + '-' + tabId).classList.add('active');
    }
    
    function copyCode(button) {
      const codeBlock = button.parentElement.querySelector('pre');
      navigator.clipboard.writeText(codeBlock.textContent);
      button.textContent = '✅ Copié!';
      setTimeout(() => button.textContent = '📋 Copier', 2000);
    }
    
    function toggleCheck(item) {
      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;
      item.classList.toggle('checked', checkbox.checked);
    }
    
    async function runAllTests() {
      const baseUrl = document.getElementById('app-url').value.trim();
      if (!baseUrl) {
        alert('Veuillez entrer l\\'URL de votre application');
        return;
      }
      
      // Test Frontend
      await runTest('frontend', baseUrl, async () => {
        const response = await fetch(baseUrl, { mode: 'no-cors' });
        return true;
      });
      
      ${hasBackend ? `
      // Test API
      await runTest('api', baseUrl + '/health', async () => {
        const response = await fetch(baseUrl + '/backend/health');
        return response.ok;
      });
      ` : ''}
      
      // Add more tests as needed
    }
    
    async function runTest(testId, url, testFn) {
      const element = document.getElementById('test-' + testId);
      if (!element) return;
      
      element.className = 'test-result pending';
      element.innerHTML = '<span>⏳</span><span>' + testId + '</span><span style="margin-left: auto;">Testing...</span>';
      
      try {
        const success = await testFn();
        element.className = 'test-result ' + (success ? 'success' : 'error');
        element.innerHTML = '<span>' + (success ? '✅' : '❌') + '</span><span>' + testId + '</span><span style="margin-left: auto;">' + (success ? 'OK' : 'Échec') + '</span>';
        state.testResults[testId] = success;
      } catch (error) {
        element.className = 'test-result error';
        element.innerHTML = '<span>❌</span><span>' + testId + '</span><span style="margin-left: auto;">Erreur: ' + error.message + '</span>';
        state.testResults[testId] = false;
      }
    }
    
    function showCompletionMessage() {
      document.getElementById('completion-message').style.display = 'block';
      document.getElementById('completion-message').scrollIntoView({ behavior: 'smooth' });
    }
    
    function exportReport() {
      const report = {
        project: '${projectName}',
        completedAt: new Date().toISOString(),
        completedSections: state.completedSections,
        testResults: state.testResults
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${projectName}-liberation-report.json';
      a.click();
    }
    
    // Initialize
    updateProgress();
    showSection(state.currentSection);
  </script>
</body>
</html>`;
}

export function generateSetupCoolifyScript(projectName: string, envVars: string[]): string {
  return `#!/bin/bash
# ============================================
# Script d'automatisation Coolify
# Projet: ${projectName}
# Généré par InoPay Liberation Pack
# ============================================

set -e

# Couleurs pour l'affichage
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

echo -e "\${BLUE}╔════════════════════════════════════════════════════════╗\${NC}"
echo -e "\${BLUE}║     🚀 Configuration Coolify - ${projectName}              ║\${NC}"
echo -e "\${BLUE}╚════════════════════════════════════════════════════════╝\${NC}"
echo ""

# Vérification des prérequis
check_prerequisites() {
    echo -e "\${YELLOW}📋 Vérification des prérequis...\${NC}"
    
    if ! command -v curl &> /dev/null; then
        echo -e "\${RED}❌ curl n'est pas installé\${NC}"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "\${RED}❌ Docker n'est pas installé\${NC}"
        echo "   Installez Docker: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    
    echo -e "\${GREEN}✅ Tous les prérequis sont satisfaits\${NC}"
}

# Collecte des informations
collect_info() {
    echo ""
    echo -e "\${YELLOW}📝 Configuration...\${NC}"
    echo ""
    
    read -p "URL de votre Coolify (ex: https://coolify.mondomaine.com): " COOLIFY_URL
    read -p "Token API Coolify: " COOLIFY_TOKEN
    read -p "URL du dépôt GitHub: " GITHUB_REPO
    read -p "Nom de domaine pour l'app (ex: monapp.com): " APP_DOMAIN
    
    echo ""
    echo -e "\${YELLOW}📝 Variables d'environnement...\${NC}"
    ${envVars.map(v => `read -p "${v}: " ${v.replace(/-/g, '_')}`).join('\n    ')}
}

# Création du projet Coolify
create_coolify_project() {
    echo ""
    echo -e "\${YELLOW}🚀 Création du projet dans Coolify...\${NC}"
    
    # Appel API Coolify pour créer le projet
    PROJECT_RESPONSE=$(curl -s -X POST "\${COOLIFY_URL}/api/v1/projects" \\
        -H "Authorization: Bearer \${COOLIFY_TOKEN}" \\
        -H "Content-Type: application/json" \\
        -d '{
            "name": "${projectName}",
            "description": "Application libérée par InoPay"
        }')
    
    PROJECT_ID=$(echo \$PROJECT_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "\$PROJECT_ID" ]; then
        echo -e "\${RED}❌ Erreur lors de la création du projet\${NC}"
        echo \$PROJECT_RESPONSE
        exit 1
    fi
    
    echo -e "\${GREEN}✅ Projet créé avec l'ID: \$PROJECT_ID\${NC}"
}

# Configuration des variables d'environnement
configure_env_vars() {
    echo ""
    echo -e "\${YELLOW}🔐 Configuration des variables d'environnement...\${NC}"
    
    # Cette partie nécessite l'API Coolify pour configurer les env vars
    # Exemple de structure
    ${envVars.map(v => `
    curl -s -X POST "\${COOLIFY_URL}/api/v1/applications/\${APP_ID}/envs" \\
        -H "Authorization: Bearer \${COOLIFY_TOKEN}" \\
        -H "Content-Type: application/json" \\
        -d '{"key": "${v}", "value": "'\${${v.replace(/-/g, '_')}}'", "is_build_time": false}'`).join('\n')}
    
    echo -e "\${GREEN}✅ Variables d'environnement configurées\${NC}"
}

# Déploiement
deploy() {
    echo ""
    echo -e "\${YELLOW}🚀 Lancement du déploiement...\${NC}"
    
    curl -s -X POST "\${COOLIFY_URL}/api/v1/applications/\${APP_ID}/deploy" \\
        -H "Authorization: Bearer \${COOLIFY_TOKEN}"
    
    echo -e "\${GREEN}✅ Déploiement lancé!\${NC}"
    echo ""
    echo -e "\${BLUE}╔════════════════════════════════════════════════════════╗\${NC}"
    echo -e "\${BLUE}║     📋 Prochaines étapes                               ║\${NC}"
    echo -e "\${BLUE}╠════════════════════════════════════════════════════════╣\${NC}"
    echo -e "\${BLUE}║  1. Vérifiez le build dans Coolify                     ║\${NC}"
    echo -e "\${BLUE}║  2. Configurez le domaine dans Coolify                 ║\${NC}"
    echo -e "\${BLUE}║  3. Testez l'application sur https://\$APP_DOMAIN      ║\${NC}"
    echo -e "\${BLUE}╚════════════════════════════════════════════════════════╝\${NC}"
}

# Exécution principale
main() {
    check_prerequisites
    collect_info
    create_coolify_project
    configure_env_vars
    deploy
}

main
`;
}

export function generateImportSupabaseSchemaScript(projectName: string): string {
  return `#!/bin/bash
# ============================================
# Script d'import de schéma Supabase
# Projet: ${projectName}
# Généré par InoPay Liberation Pack
# ============================================

set -e

# Couleurs
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}╔════════════════════════════════════════════════════════╗\${NC}"
echo -e "\${BLUE}║     💾 Import Schéma Supabase - ${projectName}             ║\${NC}"
echo -e "\${BLUE}╚════════════════════════════════════════════════════════╝\${NC}"
echo ""

# Chemin du script
SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="\${SCRIPT_DIR}/../database/migrations/001_schema.sql"

# Vérification du fichier de schéma
if [ ! -f "\$SCHEMA_FILE" ]; then
    echo -e "\${RED}❌ Fichier de schéma non trouvé: \$SCHEMA_FILE\${NC}"
    exit 1
fi

echo -e "\${GREEN}✅ Fichier de schéma trouvé\${NC}"
echo ""

# Collecte des informations de connexion
echo -e "\${YELLOW}📝 Informations de connexion PostgreSQL...\${NC}"
echo ""

read -p "Hôte PostgreSQL (ex: localhost ou IP): " DB_HOST
DB_HOST=\${DB_HOST:-localhost}

read -p "Port PostgreSQL [5432]: " DB_PORT
DB_PORT=\${DB_PORT:-5432}

read -p "Nom de la base [postgres]: " DB_NAME
DB_NAME=\${DB_NAME:-postgres}

read -p "Utilisateur [postgres]: " DB_USER
DB_USER=\${DB_USER:-postgres}

read -s -p "Mot de passe: " DB_PASSWORD
echo ""

# Test de connexion
echo ""
echo -e "\${YELLOW}🔌 Test de connexion...\${NC}"

PGPASSWORD="\$DB_PASSWORD" psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1

if [ \$? -ne 0 ]; then
    echo -e "\${RED}❌ Impossible de se connecter à la base de données\${NC}"
    exit 1
fi

echo -e "\${GREEN}✅ Connexion réussie\${NC}"

# Affichage du schéma
echo ""
echo -e "\${YELLOW}📋 Aperçu du schéma à importer:\${NC}"
echo "----------------------------------------"
head -50 "\$SCHEMA_FILE"
echo "..."
echo "----------------------------------------"
echo ""

# Confirmation
read -p "Voulez-vous importer ce schéma? (oui/non): " CONFIRM
if [ "\$CONFIRM" != "oui" ]; then
    echo -e "\${YELLOW}Import annulé\${NC}"
    exit 0
fi

# Import du schéma
echo ""
echo -e "\${YELLOW}💾 Import du schéma en cours...\${NC}"

PGPASSWORD="\$DB_PASSWORD" psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -f "\$SCHEMA_FILE"

if [ \$? -eq 0 ]; then
    echo ""
    echo -e "\${GREEN}✅ Schéma importé avec succès!\${NC}"
    
    # Affichage des tables créées
    echo ""
    echo -e "\${YELLOW}📋 Tables créées:\${NC}"
    PGPASSWORD="\$DB_PASSWORD" psql -h "\$DB_HOST" -p "\$DB_PORT" -U "\$DB_USER" -d "\$DB_NAME" -c "\\dt public.*"
else
    echo ""
    echo -e "\${RED}❌ Erreur lors de l'import du schéma\${NC}"
    exit 1
fi

echo ""
echo -e "\${BLUE}╔════════════════════════════════════════════════════════╗\${NC}"
echo -e "\${BLUE}║     ✅ Import terminé!                                  ║\${NC}"
echo -e "\${BLUE}╠════════════════════════════════════════════════════════╣\${NC}"
echo -e "\${BLUE}║  Prochaines étapes:                                    ║\${NC}"
echo -e "\${BLUE}║  1. Vérifiez les tables dans Supabase Studio           ║\${NC}"
echo -e "\${BLUE}║  2. Configurez les politiques RLS si nécessaire        ║\${NC}"
echo -e "\${BLUE}║  3. Importez vos données existantes                    ║\${NC}"
echo -e "\${BLUE}╚════════════════════════════════════════════════════════╝\${NC}"
`;
}

export function generateCoolifyStepByStepGuide(projectName: string): string {
  return `# 🚀 Guide Coolify Pas-à-Pas - ${projectName}

## Table des matières
1. [Prérequis](#prérequis)
2. [Installation de Coolify](#installation-de-coolify)
3. [Configuration GitHub](#configuration-github)
4. [Déploiement de l'application](#déploiement-de-lapplication)
5. [Configuration du domaine](#configuration-du-domaine)
6. [Troubleshooting](#troubleshooting)

---

## Prérequis

### Serveur VPS
- **Minimum recommandé**: 2 vCPU, 4GB RAM, 40GB SSD
- **OS**: Ubuntu 22.04 LTS (recommandé)
- **Accès**: SSH avec privilèges root

### Vérifications préalables

\`\`\`bash
# Testez la connexion SSH
ssh root@VOTRE_IP

# Vérifiez la version du système
cat /etc/os-release

# Vérifiez les ressources disponibles
free -h
df -h
\`\`\`

---

## Installation de Coolify

### Étape 1: Installation automatique

\`\`\`bash
# Sur votre VPS
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
\`\`\`

Cette commande installe:
- Docker et Docker Compose
- Coolify et ses dépendances
- Traefik comme reverse proxy
- PostgreSQL pour Coolify

### Étape 2: Accès à l'interface

\`\`\`
https://VOTRE_IP:8000
\`\`\`

1. Créez votre compte administrateur
2. Configurez le mot de passe
3. Vous êtes prêt!

---

## Configuration GitHub

### Étape 1: Préparez votre dépôt

\`\`\`bash
# Dans le dossier du Liberation Pack
cd ${projectName}
git init
git add .
git commit -m "🚀 Initial liberation commit"

# Créez un dépôt sur GitHub puis:
git remote add origin https://github.com/VOTRE_USERNAME/${projectName}.git
git push -u origin main
\`\`\`

### Étape 2: Connectez GitHub à Coolify

1. Dans Coolify: **Settings** > **Git Sources**
2. Cliquez **+ Add GitHub App**
3. Autorisez Coolify sur votre compte GitHub
4. Sélectionnez les dépôts à autoriser

### Alternative: Personal Access Token

Si vous préférez ne pas utiliser GitHub App:

1. GitHub: **Settings** > **Developer settings** > **Personal access tokens**
2. **Generate new token (classic)**
3. Cochez: \`repo\`, \`read:packages\`, \`workflow\`
4. Copiez le token et ajoutez-le dans Coolify

---

## Déploiement de l'application

### Étape 1: Créez un projet

1. Dashboard Coolify: **+ New Project**
2. Nom: \`${projectName}\`
3. Cliquez **Create**

### Étape 2: Ajoutez l'application

1. Dans le projet: **+ New Resource**
2. Sélectionnez **Docker Compose**
3. Choisissez **GitHub** comme source
4. Sélectionnez votre dépôt
5. Branche: \`main\`

### Étape 3: Configurez les variables d'environnement

Dans **Settings** > **Environment Variables**, ajoutez:

| Variable | Description | Exemple |
|----------|-------------|---------|
| \`SUPABASE_URL\` | URL de votre Supabase SH | \`http://IP:8000\` |
| \`SUPABASE_ANON_KEY\` | Clé publique Supabase | \`eyJhbG...\` |
| \`DATABASE_URL\` | URL PostgreSQL | \`postgresql://...\` |

### Étape 4: Lancez le build

1. Cliquez **Deploy**
2. Surveillez les logs de build
3. Attendez "Successfully deployed"

---

## Configuration du domaine

### Étape 1: DNS chez votre registrar

Ajoutez ces enregistrements:

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | @ | IP_DU_VPS | 3600 |
| A | www | IP_DU_VPS | 3600 |
| A | api | IP_DU_VPS | 3600 |

### Étape 2: Configuration Coolify

1. Application > **Settings** > **Domains**
2. Ajoutez \`https://votre-domaine.com\`
3. SSL: Laissez sur **Auto (Let's Encrypt)**
4. Redéployez

### Étape 3: Vérification

\`\`\`bash
# Testez la résolution DNS
nslookup votre-domaine.com

# Testez HTTPS
curl -I https://votre-domaine.com
\`\`\`

---

## Troubleshooting

### Build qui échoue

**Symptôme**: Le build s'arrête avec une erreur npm

**Solution**:
\`\`\`bash
# Vérifiez que node_modules n'est pas dans le repo
echo "node_modules/" >> .gitignore
git rm -r --cached node_modules
git commit -m "Remove node_modules from git"
git push
\`\`\`

### Container qui restart en boucle

**Symptôme**: Status "Restarting" dans Coolify

**Solution**:
1. Vérifiez les logs: **Logs** tab
2. Vérifiez les variables d'environnement
3. Testez le Dockerfile localement:
   \`\`\`bash
   docker build -t test .
   docker run -p 3000:80 test
   \`\`\`

### SSL qui ne fonctionne pas

**Symptôme**: Erreur certificat ou HTTP non redirigé

**Solutions**:
1. Vérifiez que le DNS pointe bien vers le VPS
2. Attendez la propagation DNS (jusqu'à 48h)
3. Dans Coolify, cliquez **Regenerate SSL**
4. Vérifiez que les ports 80 et 443 sont ouverts:
   \`\`\`bash
   sudo ufw allow 80
   sudo ufw allow 443
   \`\`\`

### Connexion à la base refusée

**Symptôme**: "Connection refused" à PostgreSQL

**Solution**:
1. Vérifiez que Supabase tourne:
   \`\`\`bash
   docker compose -f /opt/supabase/docker/docker-compose.yml ps
   \`\`\`
2. Vérifiez le réseau Docker:
   \`\`\`bash
   docker network ls
   docker network inspect supabase_default
   \`\`\`
3. Utilisez le nom du service au lieu de localhost:
   \`DATABASE_URL=postgresql://postgres:PASSWORD@supabase-db:5432/postgres\`

---

## 📚 Ressources

- [Documentation Coolify](https://coolify.io/docs)
- [Documentation Supabase Self-Hosted](https://supabase.com/docs/guides/self-hosting)
- [InoPay Support](https://inopay.fr/support)

---

*Généré par InoPay Liberation Pack - Version 1.0*
`;
}
