// Template HTML pour le guide de déploiement interactif
export const generateDeployGuideHTML = (projectName: string, options: {
  hasBackend: boolean;
  hasDatabase: boolean;
  envVars: string[];
  backendRoutes?: string[];
}) => {
  const { hasBackend, hasDatabase, envVars, backendRoutes = [] } = options;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guide de Déploiement - ${projectName}</title>
  <style>
    :root {
      --primary: #6366f1;
      --primary-light: #818cf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --bg: #0f172a;
      --bg-card: #1e293b;
      --bg-code: #0d1117;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --border: #334155;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      margin-bottom: 3rem;
      padding: 2rem;
      background: linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%);
      border-radius: 1rem;
    }
    
    header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    
    header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }
    
    .progress-bar {
      background: var(--bg-card);
      border-radius: 9999px;
      height: 8px;
      margin: 2rem 0;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--success));
      width: 0%;
      transition: width 0.5s ease;
    }
    
    .progress-text {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    
    section {
      background: var(--bg-card);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid var(--border);
    }
    
    section h2 {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      font-size: 1.25rem;
    }
    
    section h2 .step-num {
      background: var(--primary);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: bold;
    }
    
    section h2.completed .step-num {
      background: var(--success);
    }
    
    .checklist {
      list-style: none;
    }
    
    .checklist li {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);
    }
    
    .checklist li:last-child {
      border-bottom: none;
    }
    
    .checklist input[type="checkbox"] {
      width: 20px;
      height: 20px;
      accent-color: var(--success);
      cursor: pointer;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .checklist label {
      cursor: pointer;
      flex: 1;
    }
    
    .checklist .checked {
      text-decoration: line-through;
      opacity: 0.6;
    }
    
    .code-block {
      position: relative;
      background: var(--bg-code);
      border-radius: 0.5rem;
      padding: 1rem;
      margin: 1rem 0;
      overflow-x: auto;
      border: 1px solid var(--border);
    }
    
    .code-block code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.875rem;
      white-space: pre-wrap;
      word-break: break-all;
    }
    
    .copy-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
      font-size: 0.75rem;
      transition: all 0.2s;
    }
    
    .copy-btn:hover {
      background: var(--primary-light);
    }
    
    .copy-btn.copied {
      background: var(--success);
    }
    
    .alert {
      padding: 1rem;
      border-radius: 0.5rem;
      margin: 1rem 0;
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }
    
    .alert-info {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid var(--primary);
    }
    
    .alert-warning {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid var(--warning);
    }
    
    .alert-success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid var(--success);
    }
    
    .alert-icon {
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    
    .env-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    
    .env-table th,
    .env-table td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    
    .env-table th {
      background: var(--bg);
      font-weight: 600;
    }
    
    .env-table code {
      background: var(--bg);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.875rem;
    }
    
    .accordion {
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      margin: 1rem 0;
      overflow: hidden;
    }
    
    .accordion-header {
      background: var(--bg);
      padding: 1rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
    }
    
    .accordion-header:hover {
      background: rgba(99, 102, 241, 0.1);
    }
    
    .accordion-content {
      padding: 1rem;
      display: none;
    }
    
    .accordion.open .accordion-content {
      display: block;
    }
    
    .accordion.open .accordion-arrow {
      transform: rotate(180deg);
    }
    
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    
    footer a {
      color: var(--primary-light);
      text-decoration: none;
    }
    
    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }
      
      header h1 {
        font-size: 1.75rem;
      }
      
      section {
        padding: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 ${projectName}</h1>
      <p>Guide de déploiement autonome</p>
    </header>
    
    <div class="progress-bar">
      <div class="progress-fill" id="progressFill"></div>
    </div>
    <p class="progress-text"><span id="progressPercent">0</span>% complété</p>
    
    <!-- Section 1: Prérequis -->
    <section id="section-1">
      <h2><span class="step-num">1</span> Prérequis</h2>
      <ul class="checklist" data-section="1">
        <li>
          <input type="checkbox" id="check-1-1">
          <label for="check-1-1">
            <strong>Serveur VPS</strong> - Ubuntu 22.04 ou supérieur avec accès SSH root
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-1-2">
          <label for="check-1-2">
            <strong>Nom de domaine</strong> (optionnel) - Configuré avec un enregistrement A vers l'IP du serveur
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-1-3">
          <label for="check-1-3">
            <strong>Client SSH</strong> - Terminal, PuTTY (Windows), ou similaire
          </label>
        </li>
      </ul>
    </section>
    
    <!-- Section 2: Upload des fichiers -->
    <section id="section-2">
      <h2><span class="step-num">2</span> Upload des fichiers</h2>
      
      <div class="alert alert-info">
        <span class="alert-icon">💡</span>
        <div>Transférez le contenu du ZIP vers votre serveur avec SCP ou SFTP.</div>
      </div>
      
      <ul class="checklist" data-section="2">
        <li>
          <input type="checkbox" id="check-2-1">
          <label for="check-2-1">
            Se connecter au serveur via SSH
            <div class="code-block">
              <code>ssh root@VOTRE_IP_SERVEUR</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-2-2">
          <label for="check-2-2">
            Créer le dossier du projet
            <div class="code-block">
              <code>mkdir -p /opt/${projectName.toLowerCase().replace(/\s+/g, '-')} && cd /opt/${projectName.toLowerCase().replace(/\s+/g, '-')}</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-2-3">
          <label for="check-2-3">
            Transférer le ZIP (depuis votre machine locale)
            <div class="code-block">
              <code>scp liberation-pack.zip root@VOTRE_IP_SERVEUR:/opt/${projectName.toLowerCase().replace(/\s+/g, '-')}/</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-2-4">
          <label for="check-2-4">
            Extraire l'archive (sur le serveur)
            <div class="code-block">
              <code>unzip liberation-pack.zip && rm liberation-pack.zip</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
      </ul>
    </section>
    
    <!-- Section 3: Installation Docker -->
    <section id="section-3">
      <h2><span class="step-num">3</span> Installation de Docker</h2>
      
      <div class="alert alert-warning">
        <span class="alert-icon">⚠️</span>
        <div>Si Docker est déjà installé, passez cette étape.</div>
      </div>
      
      <ul class="checklist" data-section="3">
        <li>
          <input type="checkbox" id="check-3-1">
          <label for="check-3-1">
            Installation automatique de Docker
            <div class="code-block">
              <code>curl -fsSL https://get.docker.com | sh</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-3-2">
          <label for="check-3-2">
            Vérifier l'installation
            <div class="code-block">
              <code>docker --version && docker compose version</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
      </ul>
    </section>
    
    <!-- Section 4: Configuration -->
    <section id="section-4">
      <h2><span class="step-num">4</span> Configuration des variables d'environnement</h2>
      
      <ul class="checklist" data-section="4">
        <li>
          <input type="checkbox" id="check-4-1">
          <label for="check-4-1">
            Copier le fichier exemple
            <div class="code-block">
              <code>cp .env.example .env</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-4-2">
          <label for="check-4-2">
            Éditer les variables (utilisez nano ou vim)
            <div class="code-block">
              <code>nano .env</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
      </ul>
      
      <h3 style="margin-top: 1.5rem; margin-bottom: 1rem;">Variables à configurer :</h3>
      <table class="env-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Description</th>
            <th>Requis</th>
          </tr>
        </thead>
        <tbody>
          ${envVars.map(v => `
          <tr>
            <td><code>${v}</code></td>
            <td>${getEnvVarDescription(v)}</td>
            <td>${isEnvVarRequired(v) ? '✅ Oui' : '❌ Non'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
    
    ${hasDatabase ? `
    <!-- Section 5: Base de données -->
    <section id="section-5">
      <h2><span class="step-num">5</span> Initialisation de la base de données</h2>
      
      <ul class="checklist" data-section="5">
        <li>
          <input type="checkbox" id="check-5-1">
          <label for="check-5-1">
            Démarrer PostgreSQL
            <div class="code-block">
              <code>docker compose up -d postgres</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-5-2">
          <label for="check-5-2">
            Attendre que PostgreSQL soit prêt (30 secondes)
            <div class="code-block">
              <code>sleep 30 && docker compose logs postgres | tail -5</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-5-3">
          <label for="check-5-3">
            Exécuter les migrations
            <div class="code-block">
              <code>docker compose exec postgres psql -U app -d app -f /docker-entrypoint-initdb.d/001_schema.sql</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
      </ul>
    </section>
    ` : ''}
    
    <!-- Section 6: Déploiement -->
    <section id="section-${hasDatabase ? '6' : '5'}">
      <h2><span class="step-num">${hasDatabase ? '6' : '5'}</span> Déploiement</h2>
      
      <ul class="checklist" data-section="${hasDatabase ? '6' : '5'}">
        <li>
          <input type="checkbox" id="check-${hasDatabase ? '6' : '5'}-1">
          <label for="check-${hasDatabase ? '6' : '5'}-1">
            Construire et démarrer tous les services
            <div class="code-block">
              <code>docker compose up -d --build</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-${hasDatabase ? '6' : '5'}-2">
          <label for="check-${hasDatabase ? '6' : '5'}-2">
            Vérifier le statut des conteneurs
            <div class="code-block">
              <code>docker compose ps</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        <li>
          <input type="checkbox" id="check-${hasDatabase ? '6' : '5'}-3">
          <label for="check-${hasDatabase ? '6' : '5'}-3">
            Voir les logs en temps réel
            <div class="code-block">
              <code>docker compose logs -f</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
      </ul>
      
      <div class="alert alert-success">
        <span class="alert-icon">🎉</span>
        <div>
          <strong>Votre application est maintenant accessible !</strong><br>
          Frontend : <code>http://VOTRE_IP_SERVEUR</code><br>
          ${hasBackend ? `API Backend : <code>http://VOTRE_IP_SERVEUR/api</code>` : ''}
        </div>
      </div>
    </section>
    
    <!-- Section 7: Vérification -->
    <section id="section-${hasDatabase ? '7' : '6'}">
      <h2><span class="step-num">${hasDatabase ? '7' : '6'}</span> Vérification</h2>
      
      <ul class="checklist" data-section="${hasDatabase ? '7' : '6'}">
        <li>
          <input type="checkbox" id="check-${hasDatabase ? '7' : '6'}-1">
          <label for="check-${hasDatabase ? '7' : '6'}-1">
            Tester le frontend dans votre navigateur
          </label>
        </li>
        ${hasBackend ? `
        <li>
          <input type="checkbox" id="check-${hasDatabase ? '7' : '6'}-2">
          <label for="check-${hasDatabase ? '7' : '6'}-2">
            Tester le health check de l'API
            <div class="code-block">
              <code>curl http://localhost:3000/health</code>
              <button class="copy-btn" onclick="copyCode(this)">Copier</button>
            </div>
          </label>
        </li>
        ` : ''}
      </ul>
    </section>
    
    <!-- Troubleshooting -->
    <section>
      <h2>🔧 Dépannage</h2>
      
      <div class="accordion">
        <div class="accordion-header" onclick="toggleAccordion(this)">
          Les conteneurs ne démarrent pas
          <span class="accordion-arrow">▼</span>
        </div>
        <div class="accordion-content">
          <div class="code-block">
            <code># Voir les logs détaillés
docker compose logs --tail=100

# Reconstruire les images
docker compose down
docker compose build --no-cache
docker compose up -d</code>
            <button class="copy-btn" onclick="copyCode(this)">Copier</button>
          </div>
        </div>
      </div>
      
      <div class="accordion">
        <div class="accordion-header" onclick="toggleAccordion(this)">
          Erreur de connexion à la base de données
          <span class="accordion-arrow">▼</span>
        </div>
        <div class="accordion-content">
          <p>Vérifiez que :</p>
          <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
            <li>Le conteneur PostgreSQL est bien démarré</li>
            <li>Les variables d'environnement DB_* sont correctement configurées</li>
            <li>Le port 5432 n'est pas utilisé par un autre service</li>
          </ul>
        </div>
      </div>
      
      <div class="accordion">
        <div class="accordion-header" onclick="toggleAccordion(this)">
          Le site n'est pas accessible
          <span class="accordion-arrow">▼</span>
        </div>
        <div class="accordion-content">
          <div class="code-block">
            <code># Vérifier le pare-feu
ufw allow 80
ufw allow 443

# Redémarrer nginx
docker compose restart frontend</code>
            <button class="copy-btn" onclick="copyCode(this)">Copier</button>
          </div>
        </div>
      </div>
    </section>
    
    <footer>
      <p>Généré par <strong>InoPay</strong> - Libérez votre code !</p>
      <p>Besoin d'aide ? <a href="https://inopay.fr/support">Contact support</a></p>
    </footer>
  </div>
  
  <script>
    // Gestion des checkboxes et progression
    const STORAGE_KEY = 'deploy-progress-${projectName.replace(/[^a-zA-Z0-9]/g, '')}';
    
    function loadProgress() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      } catch {
        return {};
      }
    }
    
    function saveProgress(progress) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
    
    function updateProgress() {
      const checkboxes = document.querySelectorAll('.checklist input[type="checkbox"]');
      const checked = document.querySelectorAll('.checklist input[type="checkbox"]:checked');
      const percent = Math.round((checked.length / checkboxes.length) * 100);
      
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressPercent').textContent = percent;
      
      // Update section headers
      document.querySelectorAll('section').forEach(section => {
        const list = section.querySelector('.checklist');
        if (list) {
          const sectionChecks = list.querySelectorAll('input[type="checkbox"]');
          const sectionChecked = list.querySelectorAll('input[type="checkbox"]:checked');
          if (sectionChecks.length === sectionChecked.length && sectionChecks.length > 0) {
            section.querySelector('h2').classList.add('completed');
          } else {
            section.querySelector('h2').classList.remove('completed');
          }
        }
      });
    }
    
    function copyCode(btn) {
      const code = btn.parentElement.querySelector('code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copié !';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copier';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
    
    function toggleAccordion(header) {
      header.parentElement.classList.toggle('open');
    }
    
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      const progress = loadProgress();
      
      document.querySelectorAll('.checklist input[type="checkbox"]').forEach(cb => {
        if (progress[cb.id]) {
          cb.checked = true;
          cb.closest('label')?.classList.add('checked');
        }
        
        cb.addEventListener('change', (e) => {
          const p = loadProgress();
          p[e.target.id] = e.target.checked;
          saveProgress(p);
          
          if (e.target.checked) {
            e.target.closest('li').querySelector('label')?.classList.add('checked');
          } else {
            e.target.closest('li').querySelector('label')?.classList.remove('checked');
          }
          
          updateProgress();
        });
      });
      
      updateProgress();
    });
  </script>
</body>
</html>`;
};

function getEnvVarDescription(varName: string): string {
  const descriptions: Record<string, string> = {
    'PORT': 'Port du serveur backend (défaut: 3000)',
    'NODE_ENV': 'Environnement (development/production)',
    'DATABASE_URL': 'URL de connexion PostgreSQL',
    'POSTGRES_USER': 'Utilisateur PostgreSQL',
    'POSTGRES_PASSWORD': 'Mot de passe PostgreSQL',
    'POSTGRES_DB': 'Nom de la base de données',
    'JWT_SECRET': 'Clé secrète pour les tokens JWT (min 32 caractères)',
    'SUPABASE_URL': 'URL du projet Supabase (si migration)',
    'SUPABASE_SERVICE_ROLE_KEY': 'Clé de service Supabase',
    'STRIPE_SECRET_KEY': 'Clé secrète Stripe',
    'STRIPE_WEBHOOK_SECRET': 'Secret du webhook Stripe',
    'RESEND_API_KEY': 'Clé API Resend pour les emails',
    'ANTHROPIC_API_KEY': 'Clé API Anthropic/Claude',
    'OPENAI_API_KEY': 'Clé API OpenAI',
    'GITHUB_PERSONAL_ACCESS_TOKEN': 'Token GitHub personnel',
    'DOMAIN': 'Nom de domaine (ex: monapp.com)',
    'SSL_EMAIL': 'Email pour certificats SSL Let\'s Encrypt',
  };
  return descriptions[varName] || 'Variable d\'environnement personnalisée';
}

function isEnvVarRequired(varName: string): boolean {
  const required = [
    'DATABASE_URL',
    'POSTGRES_PASSWORD',
    'JWT_SECRET',
  ];
  return required.includes(varName);
}
