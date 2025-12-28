/**
 * Post-Deployment Checklist Generator
 * Generates an interactive HTML page that verifies services and tests endpoints
 */

export interface ServiceCheck {
  name: string;
  type: 'http' | 'database' | 'api' | 'webhook' | 'storage' | 'auth';
  endpoint: string;
  method?: 'GET' | 'POST' | 'HEAD';
  expectedStatus?: number;
  timeout?: number;
  description: string;
  critical: boolean;
  testPayload?: Record<string, unknown>;
}

export interface ChecklistConfig {
  projectName: string;
  baseUrl: string;
  services: ServiceCheck[];
  envVars: string[];
  hasAuth: boolean;
  hasDatabase: boolean;
  hasStorage: boolean;
  webhooks: { name: string; type: string; url: string }[];
}

export function generatePostDeploymentChecklist(config: ChecklistConfig): string {
  const { projectName, services, envVars, hasAuth, hasDatabase, hasStorage, webhooks } = config;
  
  const checksJson = JSON.stringify(services, null, 2);
  const envVarsJson = JSON.stringify(envVars);
  const webhooksJson = JSON.stringify(webhooks);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checklist Post-Déploiement - ${projectName}</title>
  <style>
    :root {
      --primary: #6366f1;
      --primary-light: #818cf8;
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #3b82f6;
      --bg: #0f172a;
      --bg-card: #1e293b;
      --bg-code: #0d1117;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --border: #334155;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    
    header {
      text-align: center;
      padding: 3rem 2rem;
      background: linear-gradient(135deg, var(--primary), #4f46e5);
      border-radius: 1.5rem;
      margin-bottom: 2rem;
      position: relative;
      overflow: hidden;
    }
    
    header::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    
    header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; position: relative; }
    header p { opacity: 0.9; position: relative; }
    
    .config-section {
      background: var(--bg-card);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
      border: 1px solid var(--border);
    }
    
    .config-section h3 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      color: var(--primary-light);
    }
    
    .input-group {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .input-group label {
      flex: 1;
      min-width: 200px;
    }
    
    .input-group label span {
      display: block;
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }
    
    input[type="text"], input[type="url"] {
      width: 100%;
      padding: 0.75rem 1rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text);
      font-size: 1rem;
    }
    
    input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background: var(--primary);
      color: white;
    }
    
    .btn-primary:hover { background: var(--primary-light); transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    
    .btn-outline {
      background: transparent;
      border: 2px solid var(--border);
      color: var(--text);
    }
    
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }
    
    .actions {
      display: flex;
      gap: 1rem;
      margin: 2rem 0;
      flex-wrap: wrap;
    }
    
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: var(--bg-card);
      border-radius: 1rem;
      padding: 1.25rem;
      text-align: center;
      border: 1px solid var(--border);
    }
    
    .stat-card .value {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }
    
    .stat-card .label { color: var(--text-muted); font-size: 0.875rem; }
    .stat-card.success .value { color: var(--success); }
    .stat-card.warning .value { color: var(--warning); }
    .stat-card.danger .value { color: var(--danger); }
    .stat-card.pending .value { color: var(--text-muted); }
    
    .checks-grid {
      display: grid;
      gap: 1rem;
    }
    
    .check-card {
      background: var(--bg-card);
      border-radius: 1rem;
      padding: 1.25rem;
      border: 1px solid var(--border);
      transition: all 0.3s;
    }
    
    .check-card.running { border-color: var(--info); animation: pulse 1.5s infinite; }
    .check-card.success { border-color: var(--success); }
    .check-card.failed { border-color: var(--danger); }
    .check-card.warning { border-color: var(--warning); }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .check-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    
    .check-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    
    .check-card.pending .check-icon { background: rgba(148, 163, 184, 0.2); }
    .check-card.running .check-icon { background: rgba(59, 130, 246, 0.2); }
    .check-card.success .check-icon { background: rgba(34, 197, 94, 0.2); }
    .check-card.failed .check-icon { background: rgba(239, 68, 68, 0.2); }
    .check-card.warning .check-icon { background: rgba(245, 158, 11, 0.2); }
    
    .check-info { flex: 1; }
    .check-info h4 { margin-bottom: 0.25rem; }
    .check-info p { color: var(--text-muted); font-size: 0.875rem; }
    
    .check-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge-critical { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
    .badge-optional { background: rgba(148, 163, 184, 0.2); color: var(--text-muted); }
    
    .check-details {
      background: var(--bg);
      border-radius: 0.5rem;
      padding: 1rem;
      font-family: 'Fira Code', monospace;
      font-size: 0.8rem;
      margin-top: 0.75rem;
      overflow-x: auto;
    }
    
    .check-details .endpoint { color: var(--info); }
    .check-details .status { margin-top: 0.5rem; }
    .check-details .timing { color: var(--text-muted); }
    .check-details .error { color: var(--danger); }
    .check-details .response { color: var(--success); white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; }
    
    .section-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 2rem 0 1rem;
      font-size: 1.25rem;
    }
    
    .section-title .icon {
      width: 36px;
      height: 36px;
      background: var(--primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .env-check-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 0.75rem;
    }
    
    .env-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-card);
      border-radius: 0.5rem;
      border: 1px solid var(--border);
    }
    
    .env-item code { font-family: 'Fira Code', monospace; font-size: 0.875rem; }
    .env-item .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .env-item.set .status-dot { background: var(--success); }
    .env-item.missing .status-dot { background: var(--danger); }
    
    .webhook-list {
      display: grid;
      gap: 1rem;
    }
    
    .webhook-item {
      background: var(--bg-card);
      border-radius: 0.75rem;
      padding: 1.25rem;
      border: 1px solid var(--border);
    }
    
    .webhook-item h4 { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .webhook-item .type { color: var(--primary-light); font-size: 0.875rem; }
    .webhook-item .url { font-family: 'Fira Code', monospace; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; word-break: break-all; }
    .webhook-item .btn-test { margin-top: 0.75rem; padding: 0.5rem 1rem; font-size: 0.875rem; }
    
    .progress-bar {
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
      margin: 1rem 0;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--success));
      border-radius: 3px;
      transition: width 0.3s;
    }
    
    .log-panel {
      background: var(--bg-code);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-top: 2rem;
      border: 1px solid var(--border);
      max-height: 400px;
      overflow-y: auto;
    }
    
    .log-panel h3 { margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    
    .log-entry {
      font-family: 'Fira Code', monospace;
      font-size: 0.8rem;
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--border);
    }
    
    .log-entry:last-child { border-bottom: none; }
    .log-entry .time { color: var(--text-muted); }
    .log-entry.info { color: var(--info); }
    .log-entry.success { color: var(--success); }
    .log-entry.error { color: var(--danger); }
    .log-entry.warning { color: var(--warning); }
    
    .summary-card {
      background: linear-gradient(135deg, var(--bg-card), var(--bg));
      border-radius: 1.5rem;
      padding: 2rem;
      margin-top: 2rem;
      border: 1px solid var(--border);
      text-align: center;
    }
    
    .summary-card h2 { margin-bottom: 1rem; }
    .summary-card .score { font-size: 4rem; font-weight: 700; margin: 1rem 0; }
    .summary-card .score.good { color: var(--success); }
    .summary-card .score.medium { color: var(--warning); }
    .summary-card .score.bad { color: var(--danger); }
    .summary-card p { color: var(--text-muted); max-width: 600px; margin: 0 auto; }
    
    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid var(--primary);
      border-radius: 0.5rem;
      color: var(--primary);
      font-size: 0.875rem;
      cursor: pointer;
      margin-top: 0.5rem;
    }
    
    .retry-btn:hover { background: rgba(99, 102, 241, 0.3); }
    
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header { padding: 2rem 1rem; }
      header h1 { font-size: 1.75rem; }
      .input-group { flex-direction: column; }
      .actions { flex-direction: column; }
      .btn { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>✅ Checklist Post-Déploiement</h1>
      <p>${projectName} - Vérification automatique des services</p>
    </header>
    
    <section class="config-section">
      <h3>⚙️ Configuration</h3>
      <div class="input-group">
        <label>
          <span>URL de base de l'application</span>
          <input type="url" id="baseUrl" placeholder="https://votre-domaine.com" value="">
        </label>
        <label>
          <span>JWT Token (optionnel, pour endpoints protégés)</span>
          <input type="text" id="authToken" placeholder="eyJhbGciOiJIUzI1NiIs...">
        </label>
      </div>
    </section>
    
    <div class="actions">
      <button class="btn btn-primary" id="runAllBtn" onclick="runAllChecks()">
        🚀 Lancer toutes les vérifications
      </button>
      <button class="btn btn-outline" onclick="resetChecks()">
        🔄 Réinitialiser
      </button>
      <button class="btn btn-outline" onclick="exportReport()">
        📄 Exporter le rapport
      </button>
    </div>
    
    <div class="progress-bar" id="progressBar" style="display: none;">
      <div class="progress-fill" id="progressFill" style="width: 0%"></div>
    </div>
    
    <div class="stats-bar" id="statsBar">
      <div class="stat-card pending" id="statTotal">
        <div class="value">-</div>
        <div class="label">Total</div>
      </div>
      <div class="stat-card pending" id="statPassed">
        <div class="value">-</div>
        <div class="label">Réussis</div>
      </div>
      <div class="stat-card pending" id="statFailed">
        <div class="value">-</div>
        <div class="label">Échoués</div>
      </div>
      <div class="stat-card pending" id="statTime">
        <div class="value">-</div>
        <div class="label">Durée</div>
      </div>
    </div>
    
    <h2 class="section-title">
      <span class="icon">🔍</span>
      Vérifications des services
    </h2>
    
    <div class="checks-grid" id="checksGrid">
      <!-- Checks will be populated here -->
    </div>
    
    ${envVars.length > 0 ? `
    <h2 class="section-title">
      <span class="icon">🔐</span>
      Variables d'environnement requises
    </h2>
    <div class="env-check-list" id="envList">
      <!-- Env vars will be populated here -->
    </div>
    ` : ''}
    
    ${webhooks.length > 0 ? `
    <h2 class="section-title">
      <span class="icon">🔗</span>
      Webhooks à configurer
    </h2>
    <div class="webhook-list" id="webhookList">
      <!-- Webhooks will be populated here -->
    </div>
    ` : ''}
    
    <div class="log-panel">
      <h3>📋 Journal des vérifications</h3>
      <div id="logContainer"></div>
    </div>
    
    <div class="summary-card" id="summaryCard" style="display: none;">
      <h2>Résumé</h2>
      <div class="score" id="summaryScore">-</div>
      <p id="summaryText"></p>
    </div>
  </div>
  
  <footer>
    <p>Généré par InoPay Liberation Pack • <a href="https://inopay.dev" target="_blank">inopay.dev</a></p>
  </footer>
  
  <script>
    // Configuration
    const checks = ${checksJson};
    const envVars = ${envVarsJson};
    const webhooks = ${webhooksJson};
    
    let results = [];
    let startTime = null;
    
    // Initialize UI
    function initUI() {
      const checksGrid = document.getElementById('checksGrid');
      checksGrid.innerHTML = '';
      
      checks.forEach((check, index) => {
        const card = document.createElement('div');
        card.className = 'check-card pending';
        card.id = 'check-' + index;
        card.innerHTML = \`
          <div class="check-header">
            <div class="check-icon">⏳</div>
            <div class="check-info">
              <h4>\${check.name}</h4>
              <p>\${check.description}</p>
            </div>
            <span class="check-badge \${check.critical ? 'badge-critical' : 'badge-optional'}">
              \${check.critical ? 'Critique' : 'Optionnel'}
            </span>
          </div>
          <div class="check-details">
            <div class="endpoint">\${check.method || 'GET'} \${check.endpoint}</div>
            <div class="status">En attente...</div>
          </div>
        \`;
        checksGrid.appendChild(card);
      });
      
      // Init env vars list
      const envList = document.getElementById('envList');
      if (envList) {
        envList.innerHTML = envVars.map(v => \`
          <div class="env-item" data-var="\${v}">
            <span class="status-dot"></span>
            <code>\${v}</code>
          </div>
        \`).join('');
      }
      
      // Init webhooks list
      const webhookList = document.getElementById('webhookList');
      if (webhookList) {
        webhookList.innerHTML = webhooks.map((w, i) => \`
          <div class="webhook-item" id="webhook-\${i}">
            <h4>🔗 \${w.name}</h4>
            <div class="type">\${w.type}</div>
            <div class="url">\${w.url}</div>
            <button class="btn btn-outline btn-test" onclick="testWebhook(\${i})">
              Tester le webhook
            </button>
          </div>
        \`).join('');
      }
      
      updateStats();
    }
    
    function log(message, type = 'info') {
      const container = document.getElementById('logContainer');
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + type;
      entry.innerHTML = '<span class="time">[' + time + ']</span> ' + message;
      container.insertBefore(entry, container.firstChild);
    }
    
    function updateStats() {
      const total = checks.length;
      const passed = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success && r.completed).length;
      const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) + 's' : '-';
      
      document.getElementById('statTotal').querySelector('.value').textContent = total;
      document.getElementById('statPassed').querySelector('.value').textContent = passed;
      document.getElementById('statFailed').querySelector('.value').textContent = failed;
      document.getElementById('statTime').querySelector('.value').textContent = elapsed;
      
      document.getElementById('statPassed').className = 'stat-card ' + (passed > 0 ? 'success' : 'pending');
      document.getElementById('statFailed').className = 'stat-card ' + (failed > 0 ? 'danger' : 'pending');
    }
    
    function updateProgress(current, total) {
      const percent = (current / total) * 100;
      document.getElementById('progressFill').style.width = percent + '%';
    }
    
    async function runCheck(index) {
      const check = checks[index];
      const card = document.getElementById('check-' + index);
      const baseUrl = document.getElementById('baseUrl').value.replace(/\\/$/, '');
      const authToken = document.getElementById('authToken').value;
      
      if (!baseUrl) {
        log('❌ Veuillez configurer l\\'URL de base', 'error');
        return { success: false, error: 'URL de base non configurée', completed: true };
      }
      
      card.className = 'check-card running';
      card.querySelector('.check-icon').textContent = '🔄';
      card.querySelector('.status').textContent = 'Vérification en cours...';
      
      const url = baseUrl + check.endpoint;
      const timeout = check.timeout || 10000;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (authToken && check.type === 'api') {
          headers['Authorization'] = 'Bearer ' + authToken;
        }
        
        const start = performance.now();
        
        const options = {
          method: check.method || 'GET',
          headers,
          signal: controller.signal
        };
        
        if (check.testPayload && ['POST', 'PUT', 'PATCH'].includes(check.method)) {
          options.body = JSON.stringify(check.testPayload);
        }
        
        const response = await fetch(url, options);
        clearTimeout(timeoutId);
        
        const elapsed = (performance.now() - start).toFixed(0);
        const expectedStatus = check.expectedStatus || 200;
        const success = response.status === expectedStatus || (response.status >= 200 && response.status < 300);
        
        let responseText = '';
        try {
          const text = await response.text();
          responseText = text.substring(0, 500);
        } catch {}
        
        card.className = 'check-card ' + (success ? 'success' : 'failed');
        card.querySelector('.check-icon').textContent = success ? '✅' : '❌';
        card.querySelector('.status').innerHTML = \`
          Status: <strong>\${response.status}</strong> (\${success ? 'OK' : 'Échec'})
          <div class="timing">Temps de réponse: \${elapsed}ms</div>
          \${responseText ? '<div class="response">' + escapeHtml(responseText) + '</div>' : ''}
        \`;
        
        log((success ? '✅' : '❌') + ' ' + check.name + ' - Status ' + response.status + ' (' + elapsed + 'ms)', success ? 'success' : 'error');
        
        return { success, status: response.status, time: elapsed, completed: true };
        
      } catch (error) {
        const errorMsg = error.name === 'AbortError' ? 'Timeout' : error.message;
        
        card.className = 'check-card failed';
        card.querySelector('.check-icon').textContent = '❌';
        card.querySelector('.status').innerHTML = \`
          <div class="error">Erreur: \${escapeHtml(errorMsg)}</div>
          <button class="retry-btn" onclick="retryCheck(\${index})">🔄 Réessayer</button>
        \`;
        
        log('❌ ' + check.name + ' - ' + errorMsg, 'error');
        
        return { success: false, error: errorMsg, completed: true };
      }
    }
    
    async function runAllChecks() {
      const baseUrl = document.getElementById('baseUrl').value;
      if (!baseUrl) {
        log('⚠️ Veuillez entrer l\\'URL de base de votre application', 'warning');
        document.getElementById('baseUrl').focus();
        return;
      }
      
      document.getElementById('runAllBtn').disabled = true;
      document.getElementById('progressBar').style.display = 'block';
      document.getElementById('summaryCard').style.display = 'none';
      
      results = [];
      startTime = Date.now();
      
      log('🚀 Démarrage des vérifications...', 'info');
      
      for (let i = 0; i < checks.length; i++) {
        const result = await runCheck(i);
        results[i] = result;
        updateProgress(i + 1, checks.length);
        updateStats();
        
        // Small delay between checks
        await new Promise(r => setTimeout(r, 200));
      }
      
      showSummary();
      document.getElementById('runAllBtn').disabled = false;
      log('✅ Vérifications terminées', 'success');
    }
    
    async function retryCheck(index) {
      const result = await runCheck(index);
      results[index] = result;
      updateStats();
      showSummary();
    }
    
    async function testWebhook(index) {
      const webhook = webhooks[index];
      const baseUrl = document.getElementById('baseUrl').value.replace(/\\/$/, '');
      
      if (!baseUrl) {
        log('⚠️ Configurez l\\'URL de base d\\'abord', 'warning');
        return;
      }
      
      const webhookEl = document.getElementById('webhook-' + index);
      const btn = webhookEl.querySelector('.btn-test');
      btn.textContent = 'Test en cours...';
      btn.disabled = true;
      
      try {
        const response = await fetch(baseUrl + '/api/' + webhook.name.replace(/-/g, '_'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, timestamp: Date.now() })
        });
        
        log((response.ok ? '✅' : '⚠️') + ' Webhook ' + webhook.name + ' - Status ' + response.status, response.ok ? 'success' : 'warning');
        btn.textContent = response.ok ? '✅ Test réussi' : '⚠️ Status ' + response.status;
        
      } catch (error) {
        log('❌ Webhook ' + webhook.name + ' - ' + error.message, 'error');
        btn.textContent = '❌ Échec';
      }
      
      setTimeout(() => {
        btn.textContent = 'Tester le webhook';
        btn.disabled = false;
      }, 3000);
    }
    
    function showSummary() {
      const total = checks.length;
      const passed = results.filter(r => r.success).length;
      const criticalFailed = checks.filter((c, i) => c.critical && results[i] && !results[i].success).length;
      
      const score = Math.round((passed / total) * 100);
      const scoreClass = score >= 90 ? 'good' : score >= 60 ? 'medium' : 'bad';
      
      let message = '';
      if (score === 100) {
        message = '🎉 Parfait ! Tous les services sont opérationnels.';
      } else if (criticalFailed > 0) {
        message = '⚠️ Attention : ' + criticalFailed + ' service(s) critique(s) ne répond(ent) pas. Vérifiez la configuration.';
      } else if (score >= 80) {
        message = '✅ La plupart des services fonctionnent. Quelques vérifications optionnelles ont échoué.';
      } else {
        message = '❌ Plusieurs services ne répondent pas. Vérifiez la configuration et les logs du serveur.';
      }
      
      document.getElementById('summaryScore').textContent = score + '%';
      document.getElementById('summaryScore').className = 'score ' + scoreClass;
      document.getElementById('summaryText').textContent = message;
      document.getElementById('summaryCard').style.display = 'block';
    }
    
    function resetChecks() {
      results = [];
      startTime = null;
      document.getElementById('progressBar').style.display = 'none';
      document.getElementById('progressFill').style.width = '0%';
      document.getElementById('summaryCard').style.display = 'none';
      document.getElementById('logContainer').innerHTML = '';
      initUI();
      log('🔄 Vérifications réinitialisées', 'info');
    }
    
    function exportReport() {
      const baseUrl = document.getElementById('baseUrl').value;
      const report = {
        project: '${projectName}',
        baseUrl,
        timestamp: new Date().toISOString(),
        results: checks.map((c, i) => ({
          ...c,
          result: results[i] || { completed: false }
        })),
        summary: {
          total: checks.length,
          passed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success && r.completed).length,
          score: Math.round((results.filter(r => r.success).length / checks.length) * 100)
        }
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-deployment-report.json';
      a.click();
      URL.revokeObjectURL(url);
      
      log('📄 Rapport exporté', 'success');
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Initialize on load
    initUI();
    log('👋 Bienvenue ! Configurez l\\'URL de base puis lancez les vérifications.', 'info');
  </script>
</body>
</html>`;
}

export function generateDefaultChecks(
  hasBackend: boolean,
  hasDatabase: boolean,
  hasAuth: boolean,
  hasStorage: boolean,
  backendRoutes: string[] = []
): ServiceCheck[] {
  const checks: ServiceCheck[] = [
    {
      name: 'Frontend',
      type: 'http',
      endpoint: '/',
      method: 'GET',
      expectedStatus: 200,
      description: 'Vérification que le frontend est accessible',
      critical: true
    },
    {
      name: 'Health Check API',
      type: 'api',
      endpoint: '/health',
      method: 'GET',
      expectedStatus: 200,
      description: 'Endpoint de santé du serveur',
      critical: true
    }
  ];

  if (hasBackend) {
    checks.push({
      name: 'Backend API',
      type: 'api',
      endpoint: '/api',
      method: 'GET',
      expectedStatus: 404, // 404 is expected for root API without specific route
      description: 'Vérification que le backend répond',
      critical: true
    });

    // Add checks for each backend route
    backendRoutes.forEach(route => {
      checks.push({
        name: `API: ${route}`,
        type: 'api',
        endpoint: `/api/${route}`,
        method: 'GET',
        description: `Endpoint ${route}`,
        critical: false
      });
    });
  }

  if (hasAuth) {
    checks.push({
      name: 'Auth Service',
      type: 'auth',
      endpoint: '/auth/v1/health',
      method: 'GET',
      description: 'Service d\'authentification',
      critical: true
    });
  }

  if (hasDatabase) {
    checks.push({
      name: 'Database Connection',
      type: 'database',
      endpoint: '/api/health?check=db',
      method: 'GET',
      description: 'Connexion à la base de données',
      critical: true
    });
  }

  if (hasStorage) {
    checks.push({
      name: 'Storage Service',
      type: 'storage',
      endpoint: '/storage/v1/status',
      method: 'GET',
      description: 'Service de stockage de fichiers',
      critical: false
    });
  }

  return checks;
}
