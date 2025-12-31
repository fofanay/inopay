#!/usr/bin/env node

/**
 * INOPAY SOVEREIGN - Script de Validation Post-Build
 * Vérifie l'intégrité du bundle généré avant déploiement
 * Usage: node scripts/validate-build.js [--strict]
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(process.cwd(), 'dist');
const STRICT_MODE = process.argv.includes('--strict');

// Configuration des validations
const CONFIG = {
  // Fichiers requis à la racine de dist/
  requiredFiles: [
    'index.html',
  ],
  // Dossiers requis
  requiredDirs: [
    'assets',
  ],
  // Extensions attendues dans assets/
  expectedAssetTypes: ['.js', '.css'],
  // Limites de taille (en bytes)
  limits: {
    maxTotalSize: 50 * 1024 * 1024,      // 50 MB max total
    maxSingleFile: 5 * 1024 * 1024,       // 5 MB max par fichier
    minIndexHtmlSize: 500,                 // index.html minimum 500 bytes
    warnChunkSize: 500 * 1024,            // Warning si chunk > 500 KB
  },
  // Patterns à NE PAS trouver dans le bundle (sécurité)
  forbiddenPatterns: [
    /sk[-_]live[-_]/i,                    // Clés Stripe live
    /sk[-_]test[-_][a-zA-Z0-9]{20,}/i,   // Clés Stripe test complètes
    /ghp_[a-zA-Z0-9]{36}/i,              // Tokens GitHub
    /xox[baprs]-[a-zA-Z0-9-]+/i,         // Tokens Slack
    /AKIA[0-9A-Z]{16}/i,                 // AWS Access Keys
  ],
  // Vérifications index.html
  indexHtmlChecks: [
    { pattern: /<title>.*<\/title>/i, name: 'Title tag' },
    { pattern: /<meta[^>]*viewport/i, name: 'Viewport meta' },
    { pattern: /assets\/.*\.js/i, name: 'JS bundle reference' },
    { pattern: /assets\/.*\.css/i, name: 'CSS bundle reference' },
  ],
};

// Couleurs console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}`),
};

let errors = 0;
let warnings = 0;

// Utilitaires
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// Validations
function checkDistExists() {
  log.title('Vérification du dossier dist/');
  
  if (!fs.existsSync(DIST_DIR)) {
    log.error(`Le dossier dist/ n'existe pas. Exécutez d'abord: npm run build`);
    errors++;
    return false;
  }
  log.success('Dossier dist/ trouvé');
  return true;
}

function checkRequiredFiles() {
  log.title('Vérification des fichiers requis');
  
  for (const file of CONFIG.requiredFiles) {
    const filePath = path.join(DIST_DIR, file);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      log.success(`${file} (${formatBytes(size)})`);
    } else {
      log.error(`Fichier manquant: ${file}`);
      errors++;
    }
  }
  
  for (const dir of CONFIG.requiredDirs) {
    const dirPath = path.join(DIST_DIR, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const fileCount = fs.readdirSync(dirPath).length;
      log.success(`${dir}/ (${fileCount} fichiers)`);
    } else {
      log.error(`Dossier manquant: ${dir}/`);
      errors++;
    }
  }
}

function checkAssetTypes() {
  log.title('Vérification des types d\'assets');
  
  const assetsDir = path.join(DIST_DIR, 'assets');
  if (!fs.existsSync(assetsDir)) return;
  
  const files = fs.readdirSync(assetsDir);
  const extensions = new Set(files.map(f => path.extname(f).toLowerCase()));
  
  for (const ext of CONFIG.expectedAssetTypes) {
    if (extensions.has(ext)) {
      const count = files.filter(f => path.extname(f).toLowerCase() === ext).length;
      log.success(`${ext} fichiers trouvés (${count})`);
    } else {
      log.warn(`Aucun fichier ${ext} trouvé dans assets/`);
      warnings++;
    }
  }
}

function checkFileSizes() {
  log.title('Vérification des tailles de fichiers');
  
  const allFiles = getAllFiles(DIST_DIR);
  let totalSize = 0;
  const largeChunks = [];
  
  for (const file of allFiles) {
    const size = fs.statSync(file).size;
    totalSize += size;
    
    const relativePath = path.relative(DIST_DIR, file);
    
    if (size > CONFIG.limits.maxSingleFile) {
      log.error(`Fichier trop volumineux: ${relativePath} (${formatBytes(size)})`);
      errors++;
    } else if (size > CONFIG.limits.warnChunkSize && file.endsWith('.js')) {
      largeChunks.push({ path: relativePath, size });
    }
  }
  
  log.info(`Taille totale: ${formatBytes(totalSize)}`);
  
  if (totalSize > CONFIG.limits.maxTotalSize) {
    log.error(`Bundle trop volumineux (max: ${formatBytes(CONFIG.limits.maxTotalSize)})`);
    errors++;
  } else {
    log.success(`Taille totale dans les limites`);
  }
  
  if (largeChunks.length > 0) {
    log.warn(`${largeChunks.length} chunk(s) volumineux détecté(s):`);
    largeChunks.forEach(c => log.warn(`  - ${c.path}: ${formatBytes(c.size)}`));
    warnings += largeChunks.length;
  }
  
  // Stats par type
  const jsFiles = allFiles.filter(f => f.endsWith('.js'));
  const cssFiles = allFiles.filter(f => f.endsWith('.css'));
  const jsSize = jsFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);
  const cssSize = cssFiles.reduce((acc, f) => acc + fs.statSync(f).size, 0);
  
  log.info(`JavaScript: ${formatBytes(jsSize)} (${jsFiles.length} fichiers)`);
  log.info(`CSS: ${formatBytes(cssSize)} (${cssFiles.length} fichiers)`);
}

function checkIndexHtml() {
  log.title('Vérification de index.html');
  
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return;
  
  const content = fs.readFileSync(indexPath, 'utf-8');
  const size = fs.statSync(indexPath).size;
  
  if (size < CONFIG.limits.minIndexHtmlSize) {
    log.error(`index.html trop petit (${formatBytes(size)})`);
    errors++;
  }
  
  for (const check of CONFIG.indexHtmlChecks) {
    if (check.pattern.test(content)) {
      log.success(check.name);
    } else {
      log.warn(`${check.name} non trouvé`);
      warnings++;
    }
  }
}

function checkSecurityPatterns() {
  log.title('Vérification de sécurité');
  
  const jsFiles = getAllFiles(DIST_DIR).filter(f => f.endsWith('.js'));
  let secretsFound = 0;
  
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(DIST_DIR, file);
    
    for (const pattern of CONFIG.forbiddenPatterns) {
      if (pattern.test(content)) {
        log.error(`Pattern sensible détecté dans ${relativePath}`);
        secretsFound++;
        errors++;
      }
    }
  }
  
  if (secretsFound === 0) {
    log.success('Aucun secret ou clé API détecté dans le bundle');
  }
}

function checkSourceMaps() {
  log.title('Vérification des source maps');
  
  const allFiles = getAllFiles(DIST_DIR);
  const mapFiles = allFiles.filter(f => f.endsWith('.map'));
  
  if (mapFiles.length > 0) {
    if (STRICT_MODE) {
      log.error(`${mapFiles.length} source map(s) trouvée(s) en mode strict`);
      errors++;
    } else {
      log.warn(`${mapFiles.length} source map(s) présente(s) (normal en dev)`);
      warnings++;
    }
  } else {
    log.success('Aucune source map (production ready)');
  }
}

// Exécution principale
function main() {
  console.log('\n🔍 INOPAY SOVEREIGN - Validation Post-Build\n');
  console.log(`Mode: ${STRICT_MODE ? 'STRICT' : 'STANDARD'}`);
  
  if (!checkDistExists()) {
    process.exit(1);
  }
  
  checkRequiredFiles();
  checkAssetTypes();
  checkFileSizes();
  checkIndexHtml();
  checkSecurityPatterns();
  checkSourceMaps();
  
  // Résumé
  log.title('Résumé');
  
  if (errors > 0) {
    log.error(`${errors} erreur(s) détectée(s)`);
  }
  if (warnings > 0) {
    log.warn(`${warnings} avertissement(s)`);
  }
  if (errors === 0 && warnings === 0) {
    log.success('Bundle validé avec succès!');
  } else if (errors === 0) {
    log.success('Bundle validé avec avertissements');
  }
  
  console.log('');
  
  if (errors > 0) {
    console.log(`${colors.red}❌ Validation échouée${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Build prêt pour déploiement${colors.reset}\n`);
    process.exit(0);
  }
}

main();
