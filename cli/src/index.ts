#!/usr/bin/env node

/**
 * ╦╔╗╔╔═╗╔═╗╔═╗╦ ╦  LIBERATOR CLI
 * ║║║║║ ║╠═╝╠═╣╚╦╝  Version 2.0.0
 * ╩╝╚╝╚═╝╩  ╩ ╩ ╩   © 2024 Inovaq Canada Inc.
 * 
 * CLI pour libérer les projets propriétaires
 * 
 * Commandes:
 *   inopay liberate <path>  - Libération complète (scan→audit→clean→rebuild→zip→export)
 *   inopay audit <path>     - Analyse sans modifier
 *   inopay scan <path>      - Scan rapide des patterns
 *   inopay serve            - Lance le dashboard local
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import inquirer from 'inquirer';
import { 
  readFileSync, 
  readdirSync, 
  statSync, 
  writeFileSync, 
  mkdirSync, 
  existsSync,
  rmSync,
  copyFileSync
} from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import { glob } from 'glob';

const VERSION = '2.0.0';

// ═══════════════════════════════════════════════════════════════
// STYLES & COULEURS
// ═══════════════════════════════════════════════════════════════

const styles = {
  // Logo & Branding
  logo: chalk.cyan.bold,
  version: chalk.dim,
  
  // Étapes
  step: chalk.blue.bold,
  stepNumber: chalk.cyan.bold,
  stepDone: chalk.green,
  stepError: chalk.red,
  
  // Niveaux
  critical: chalk.red.bold,
  major: chalk.yellow.bold,
  minor: chalk.blue,
  info: chalk.dim,
  
  // Statuts
  success: chalk.green.bold,
  warning: chalk.yellow,
  error: chalk.red.bold,
  
  // Éléments
  file: chalk.cyan,
  path: chalk.blue.underline,
  code: chalk.magenta,
  number: chalk.yellow.bold,
  highlight: chalk.white.bold,
  
  // Boîtes
  box: chalk.dim,
  boxTitle: chalk.white.bold,
};

// ═══════════════════════════════════════════════════════════════
// BANNER & UI COMPONENTS
// ═══════════════════════════════════════════════════════════════

function showBanner() {
  console.log();
  console.log(styles.logo(`
  ██╗███╗   ██╗ ██████╗ ██████╗  █████╗ ██╗   ██╗
  ██║████╗  ██║██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝
  ██║██╔██╗ ██║██║   ██║██████╔╝███████║ ╚████╔╝ 
  ██║██║╚██╗██║██║   ██║██╔═══╝ ██╔══██║  ╚██╔╝  
  ██║██║ ╚████║╚██████╔╝██║     ██║  ██║   ██║   
  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝   ╚═╝   
  `));
  console.log(styles.version(`  LIBERATOR CLI v${VERSION} - Libérez votre code\n`));
}

function showStep(number: number, total: number, title: string, status: 'pending' | 'running' | 'done' | 'error' = 'pending') {
  const icons = {
    pending: chalk.dim('○'),
    running: chalk.cyan('◉'),
    done: chalk.green('✓'),
    error: chalk.red('✗'),
  };
  
  const colors = {
    pending: chalk.dim,
    running: chalk.cyan.bold,
    done: chalk.green,
    error: chalk.red,
  };
  
  console.log(`  ${icons[status]} ${styles.stepNumber(`[${number}/${total}]`)} ${colors[status](title)}`);
}

function drawBox(title: string, content: string[], width: number = 60) {
  const horizontal = '═'.repeat(width - 2);
  const empty = ' '.repeat(width - 2);
  
  console.log(styles.box(`  ╔${horizontal}╗`));
  console.log(styles.box(`  ║`) + styles.boxTitle(title.padEnd(width - 2)) + styles.box(`║`));
  console.log(styles.box(`  ╠${horizontal}╣`));
  
  for (const line of content) {
    const trimmed = line.slice(0, width - 4);
    console.log(styles.box(`  ║ `) + trimmed.padEnd(width - 4) + styles.box(` ║`));
  }
  
  console.log(styles.box(`  ╚${horizontal}╝`));
}

function drawProgress(current: number, total: number, width: number = 40) {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  
  const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  return `[${bar}] ${styles.number(percent + '%')}`;
}

// ═══════════════════════════════════════════════════════════════
// PATTERNS DE DÉTECTION
// ═══════════════════════════════════════════════════════════════

interface PatternDefinition {
  pattern: RegExp;
  name: string;
  severity: 'critical' | 'major' | 'minor';
  suggestion: string;
}

const LOVABLE_PATTERNS: PatternDefinition[] = [
  // Critical - Core proprietary
  { pattern: /lovable\.generate\s*\(/g, name: 'lovable.generate()', severity: 'critical', suggestion: 'Remplacer par unifiedLLM.complete()' },
  { pattern: /lovableApi\s*[.(]/g, name: 'lovableApi', severity: 'critical', suggestion: 'Utiliser API REST standard' },
  { pattern: /getAIAssistant\s*\(/g, name: 'getAIAssistant()', severity: 'critical', suggestion: 'Remplacer par sovereignAI.createAssistant()' },
  { pattern: /runAssistant\s*\(/g, name: 'runAssistant()', severity: 'critical', suggestion: 'Remplacer par sovereignAI.run()' },
  { pattern: /@agent\/[a-zA-Z-]+/g, name: '@agent/* packages', severity: 'critical', suggestion: 'Supprimer et utiliser alternatives open-source' },
  { pattern: /new\s+WebSocket\s*\([^)]*lovable/gi, name: 'Lovable WebSocket', severity: 'critical', suggestion: 'Utiliser WebSocket standard' },
  
  // Major - Dependencies & Imports
  { pattern: /@lovable\/[a-zA-Z-]+/g, name: '@lovable/* packages', severity: 'major', suggestion: 'Remplacer par équivalents npm' },
  { pattern: /lovable-tagger/g, name: 'lovable-tagger', severity: 'major', suggestion: 'Supprimer ou remplacer par solution de tagging' },
  { pattern: /@gptengineer\/[a-zA-Z-]+/g, name: '@gptengineer/* packages', severity: 'major', suggestion: 'Supprimer les dépendances GPT Engineer' },
  { pattern: /from\s+['"]@\/integrations\/supabase/g, name: 'Supabase auto-generated', severity: 'major', suggestion: 'Remplacer par client Supabase standard' },
  { pattern: /EventSchema\s*[.(]/g, name: 'EventSchema', severity: 'major', suggestion: 'Utiliser Zod ou Yup pour validation' },
  { pattern: /Pattern\.[A-Z][a-zA-Z]+/g, name: 'Pattern.*', severity: 'major', suggestion: 'Implémenter patterns localement' },
  
  // Major - Telemetry
  { pattern: /fetch\s*\([^)]*lovable\.dev/gi, name: 'Lovable API fetch', severity: 'major', suggestion: 'Supprimer appels télémétrie' },
  { pattern: /sendBeacon\s*\([^)]*lovable/gi, name: 'Lovable beacon', severity: 'major', suggestion: 'Supprimer sendBeacon' },
  { pattern: /VITE_LOVABLE_[A-Z_]+/g, name: 'Lovable env vars', severity: 'major', suggestion: 'Utiliser variables d\'environnement propres' },
  
  // Minor - Annotations & Comments
  { pattern: /\/\/\s*@lovable-/g, name: '@lovable- annotations', severity: 'minor', suggestion: 'Supprimer commentaires Lovable' },
  { pattern: /\/\*\s*lovable:/g, name: 'Lovable block comments', severity: 'minor', suggestion: 'Supprimer commentaires' },
  { pattern: /data-lovable-[a-z-]+/g, name: 'data-lovable-* attributes', severity: 'minor', suggestion: 'Supprimer attributs data-lovable-*' },
  { pattern: /data-lov-id/g, name: 'data-lov-id attributes', severity: 'minor', suggestion: 'Supprimer attributs de tracking' },
  { pattern: /class="[^"]*lov-[^"]*"/g, name: 'lov-* CSS classes', severity: 'minor', suggestion: 'Renommer classes CSS' },
];

const PROPRIETARY_FILES = [
  'lovable.config.ts',
  'lovable.config.js',
  'lovable.config.json',
  '.lovable',
  '.lovablerc',
  'lovable-lock.json',
  '.agent',
  'agent.config.ts',
  '__lovable__',
  '.gpt-engineer',
  'gpt-engineer.toml',
];

const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage'];

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

interface ScanIssue {
  file: string;
  line: number;
  column: number;
  pattern: string;
  matched: string;
  severity: 'critical' | 'major' | 'minor';
  suggestion: string;
}

interface ScanResult {
  issues: ScanIssue[];
  proprietaryFiles: string[];
  totalFiles: number;
  totalLines: number;
  score: number;
  grade: string;
  summary: {
    critical: number;
    major: number;
    minor: number;
  };
}

interface CleanResult {
  filesProcessed: number;
  filesCleaned: number;
  filesRemoved: number;
  linesRemoved: number;
  changes: CleanChange[];
}

interface CleanChange {
  file: string;
  type: 'removed' | 'modified' | 'replaced';
  details: string;
}

interface RebuildResult {
  structure: string[];
  files: Map<string, string>;
  config: object;
}

interface LiberationResult {
  scan: ScanResult;
  clean: CleanResult;
  rebuild: RebuildResult;
  outputPath: string;
  zipPath: string;
  duration: number;
}

// ═══════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    try {
      const items = readdirSync(currentDir);
      
      for (const item of items) {
        if (IGNORED_DIRS.includes(item)) continue;
        
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }
  
  walk(dir);
  return files;
}

function isTextFile(filePath: string): boolean {
  const textExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.json', '.yaml', '.yml', '.toml',
    '.css', '.scss', '.sass', '.less',
    '.html', '.htm', '.xml', '.svg',
    '.md', '.mdx', '.txt', '.env',
    '.sh', '.bash', '.zsh',
    '.sql', '.graphql', '.gql',
    '.vue', '.svelte', '.astro',
  ];
  
  return textExtensions.includes(extname(filePath).toLowerCase());
}

function calculateScore(issues: ScanIssue[], proprietaryFiles: number): number {
  let score = 100;
  
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 10;
    else if (issue.severity === 'major') score -= 5;
    else score -= 1;
  }
  
  score -= proprietaryFiles * 15;
  
  return Math.max(0, Math.min(100, score));
}

function getGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

function getGradeColor(grade: string): chalk.Chalk {
  if (grade.startsWith('A')) return chalk.green.bold;
  if (grade.startsWith('B')) return chalk.cyan.bold;
  if (grade.startsWith('C')) return chalk.yellow.bold;
  if (grade.startsWith('D')) return chalk.magenta.bold;
  return chalk.red.bold;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1: SCANNER
// ═══════════════════════════════════════════════════════════════

function scanProject(projectPath: string, spinner: Ora): ScanResult {
  const issues: ScanIssue[] = [];
  const proprietaryFiles: string[] = [];
  let totalFiles = 0;
  let totalLines = 0;
  
  const files = getAllFiles(projectPath);
  totalFiles = files.length;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = relative(projectPath, file);
    const filename = basename(file);
    
    spinner.text = `Scanning: ${relativePath.slice(0, 50)}...`;
    
    // Check proprietary files
    if (PROPRIETARY_FILES.some(pf => filename.toLowerCase() === pf.toLowerCase())) {
      proprietaryFiles.push(relativePath);
      continue;
    }
    
    // Scan text files for patterns
    if (isTextFile(file)) {
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        totalLines += lines.length;
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          
          for (const patternDef of LOVABLE_PATTERNS) {
            patternDef.pattern.lastIndex = 0;
            let match;
            
            while ((match = patternDef.pattern.exec(line)) !== null) {
              issues.push({
                file: relativePath,
                line: lineNum + 1,
                column: match.index + 1,
                pattern: patternDef.name,
                matched: match[0],
                severity: patternDef.severity,
                suggestion: patternDef.suggestion,
              });
            }
          }
        }
      } catch (e) {
        // Binary or unreadable file
      }
    }
  }
  
  const score = calculateScore(issues, proprietaryFiles.length);
  const grade = getGrade(score);
  
  const summary = {
    critical: issues.filter(i => i.severity === 'critical').length,
    major: issues.filter(i => i.severity === 'major').length,
    minor: issues.filter(i => i.severity === 'minor').length,
  };
  
  return {
    issues,
    proprietaryFiles,
    totalFiles,
    totalLines,
    score,
    grade,
    summary,
  };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2: AUDIT (REPORT)
// ═══════════════════════════════════════════════════════════════

function generateAuditReport(scan: ScanResult): string[] {
  const lines: string[] = [];
  
  lines.push(`Score de Souveraineté: ${scan.score}/100 (${scan.grade})`);
  lines.push(`Fichiers analysés: ${scan.totalFiles.toLocaleString()}`);
  lines.push(`Lignes de code: ${scan.totalLines.toLocaleString()}`);
  lines.push('');
  lines.push(`🔴 Critiques: ${scan.summary.critical}`);
  lines.push(`🟡 Majeurs: ${scan.summary.major}`);
  lines.push(`🔵 Mineurs: ${scan.summary.minor}`);
  
  return lines;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 3: CLEANER
// ═══════════════════════════════════════════════════════════════

function cleanProject(projectPath: string, outputPath: string, scan: ScanResult, spinner: Ora): CleanResult {
  const changes: CleanChange[] = [];
  let filesProcessed = 0;
  let filesCleaned = 0;
  let filesRemoved = 0;
  let linesRemoved = 0;
  
  const files = getAllFiles(projectPath);
  
  // Create output directory
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = relative(projectPath, file);
    const filename = basename(file);
    const outputFile = join(outputPath, relativePath);
    
    spinner.text = `Cleaning: ${relativePath.slice(0, 50)}...`;
    
    // Skip proprietary files
    if (PROPRIETARY_FILES.some(pf => filename.toLowerCase() === pf.toLowerCase())) {
      filesRemoved++;
      changes.push({ file: relativePath, type: 'removed', details: 'Fichier propriétaire' });
      continue;
    }
    
    // Create directory structure
    const outputDir = dirname(outputFile);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    // Process text files
    if (isTextFile(file)) {
      try {
        let content = readFileSync(file, 'utf-8');
        let modified = false;
        const originalLines = content.split('\n').length;
        
        // Remove proprietary imports
        const importPatterns = [
          /^import\s+.*from\s+['"]@lovable\/.*['"];?\s*$/gm,
          /^import\s+.*from\s+['"]@agent\/.*['"];?\s*$/gm,
          /^import\s+.*from\s+['"]lovable-tagger['"];?\s*$/gm,
          /^import\s+.*from\s+['"]@gptengineer\/.*['"];?\s*$/gm,
          /^const\s+\{.*\}\s*=\s*require\(['"]@lovable\/.*['"]\);?\s*$/gm,
        ];
        
        for (const pattern of importPatterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, '// [REMOVED] Proprietary import');
            modified = true;
          }
        }
        
        // Remove/replace patterns
        for (const patternDef of LOVABLE_PATTERNS) {
          if (patternDef.pattern.test(content)) {
            // For critical patterns, comment them out
            if (patternDef.severity === 'critical') {
              content = content.replace(patternDef.pattern, `/* TODO: ${patternDef.suggestion} */`);
            } else {
              // For minor, just remove
              content = content.replace(patternDef.pattern, '');
            }
            modified = true;
          }
        }
        
        // Remove data-lov-* and data-lovable-* attributes
        content = content.replace(/\s+data-lov-id="[^"]*"/g, '');
        content = content.replace(/\s+data-lovable-[a-z-]+="[^"]*"/g, '');
        
        // Clean empty lines (max 2 consecutive)
        content = content.replace(/\n{4,}/g, '\n\n\n');
        
        const newLines = content.split('\n').length;
        linesRemoved += Math.max(0, originalLines - newLines);
        
        if (modified) {
          filesCleaned++;
          changes.push({ file: relativePath, type: 'modified', details: 'Patterns nettoyés' });
        }
        
        writeFileSync(outputFile, content);
      } catch (e) {
        // Copy as-is if can't process
        copyFileSync(file, outputFile);
      }
    } else {
      // Copy non-text files as-is
      copyFileSync(file, outputFile);
    }
    
    filesProcessed++;
  }
  
  return {
    filesProcessed,
    filesCleaned,
    filesRemoved,
    linesRemoved,
    changes,
  };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4: REBUILDER
// ═══════════════════════════════════════════════════════════════

function rebuildProject(outputPath: string, projectName: string, spinner: Ora): RebuildResult {
  const structure: string[] = [];
  const files = new Map<string, string>();
  
  spinner.text = 'Generating project structure...';
  
  // Detect if project has backend, database, etc.
  const hasBackend = existsSync(join(outputPath, 'backend')) || 
                     existsSync(join(outputPath, 'server')) ||
                     existsSync(join(outputPath, 'api'));
  
  const hasPackageJson = existsSync(join(outputPath, 'package.json'));
  
  // Create directories
  const dirs = ['docker', 'scripts'];
  for (const dir of dirs) {
    const fullPath = join(outputPath, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      structure.push(dir + '/');
    }
  }
  
  // Generate Dockerfile
  const dockerfile = `# ═══════════════════════════════════════════════════════════════
# ${projectName} - Dockerfile
# Généré par InoPay Liberator CLI v${VERSION}
# ═══════════════════════════════════════════════════════════════

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM nginx:alpine AS runner
LABEL maintainer="InoPay Liberator"
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget --spider -q http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
  writeFileSync(join(outputPath, 'Dockerfile'), dockerfile);
  files.set('Dockerfile', dockerfile);
  structure.push('Dockerfile');
  
  // Generate docker-compose.yml
  const dockerCompose = `# ═══════════════════════════════════════════════════════════════
# ${projectName} - Docker Compose
# Généré par InoPay Liberator CLI v${VERSION}
# ═══════════════════════════════════════════════════════════════

version: '3.8'

services:
  frontend:
    build: .
    container_name: ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3

  watchtower:
    image: containrrr/watchtower
    container_name: ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=86400

networks:
  default:
    name: ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-network
`;
  writeFileSync(join(outputPath, 'docker-compose.yml'), dockerCompose);
  files.set('docker-compose.yml', dockerCompose);
  structure.push('docker-compose.yml');
  
  // Generate nginx.conf
  const nginxConf = `worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /health {
            access_log off;
            return 200 'healthy';
            add_header Content-Type text/plain;
        }
    }
}
`;
  if (!existsSync(join(outputPath, 'docker'))) {
    mkdirSync(join(outputPath, 'docker'), { recursive: true });
  }
  writeFileSync(join(outputPath, 'docker/nginx.conf'), nginxConf);
  files.set('docker/nginx.conf', nginxConf);
  structure.push('docker/nginx.conf');
  
  // Generate deploy script
  const deployScript = `#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ${projectName} - Script de déploiement
# Généré par InoPay Liberator CLI v${VERSION}
# ═══════════════════════════════════════════════════════════════

set -e

echo "🚀 Déploiement de ${projectName}..."

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installation de Docker..."
    curl -fsSL https://get.docker.com | sh
fi

# Build and start
docker compose up -d --build

echo "✅ Déployé avec succès!"
echo "   Accès: http://$(hostname -I | awk '{print $1}')"
`;
  writeFileSync(join(outputPath, 'scripts/deploy.sh'), deployScript);
  files.set('scripts/deploy.sh', deployScript);
  structure.push('scripts/deploy.sh');
  
  // Generate inopay.config.json
  const config = {
    version: '1.0.0',
    name: projectName,
    liberatedAt: new Date().toISOString(),
    liberatedWith: `InoPay CLI v${VERSION}`,
    architecture: {
      frontend: true,
      backend: hasBackend,
      database: false,
    },
    deployment: {
      target: 'docker',
      port: 80,
    },
  };
  writeFileSync(join(outputPath, 'inopay.config.json'), JSON.stringify(config, null, 2));
  files.set('inopay.config.json', JSON.stringify(config, null, 2));
  structure.push('inopay.config.json');
  
  return { structure, files, config };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 5: ZIP
// ═══════════════════════════════════════════════════════════════

async function zipProject(outputPath: string, projectName: string, spinner: Ora): Promise<string> {
  const zipPath = `${outputPath}.zip`;
  
  return new Promise((resolve, reject) => {
    spinner.text = 'Creating archive...';
    
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => resolve(zipPath));
    archive.on('error', reject);
    
    archive.pipe(output);
    archive.directory(outputPath, projectName);
    archive.finalize();
  });
}

// ═══════════════════════════════════════════════════════════════
// COMMANDE PRINCIPALE: LIBERATE
// ═══════════════════════════════════════════════════════════════

async function liberateCommand(projectPath: string, options: {
  output?: string;
  dryRun: boolean;
  verbose: boolean;
  noZip: boolean;
  interactive: boolean;
}) {
  showBanner();
  
  const startTime = Date.now();
  const absolutePath = join(process.cwd(), projectPath);
  const projectName = basename(projectPath);
  const outputPath = options.output || `${absolutePath}-liberated`;
  
  // Validate project exists
  if (!existsSync(absolutePath)) {
    console.log(styles.error(`\n  ❌ Le projet n'existe pas: ${projectPath}\n`));
    process.exit(1);
  }
  
  console.log(styles.info(`  📂 Projet: ${styles.path(absolutePath)}`));
  console.log(styles.info(`  📤 Sortie: ${styles.path(outputPath)}`));
  console.log();
  
  const TOTAL_STEPS = 6;
  
  // ─────────────────────────────────────────────────────────────
  // PHASE 1: SCAN
  // ─────────────────────────────────────────────────────────────
  
  showStep(1, TOTAL_STEPS, 'Analyse des patterns propriétaires', 'running');
  const scanSpinner = ora({ text: 'Scanning...', indent: 4 }).start();
  
  const scanResult = scanProject(absolutePath, scanSpinner);
  
  scanSpinner.succeed(`${scanResult.totalFiles} fichiers analysés, ${scanResult.issues.length} problèmes détectés`);
  
  // ─────────────────────────────────────────────────────────────
  // PHASE 2: AUDIT
  // ─────────────────────────────────────────────────────────────
  
  showStep(2, TOTAL_STEPS, 'Génération du rapport d\'audit', 'running');
  const auditSpinner = ora({ text: 'Auditing...', indent: 4 }).start();
  
  await new Promise(r => setTimeout(r, 500)); // Simulate work
  
  auditSpinner.succeed('Rapport généré');
  
  // Show audit summary
  console.log();
  const gradeColor = getGradeColor(scanResult.grade);
  console.log(`    ${styles.highlight('Score:')} ${gradeColor(scanResult.score + '/100')} ${gradeColor('(' + scanResult.grade + ')')}`);
  console.log(`    ${styles.critical('● Critiques:')} ${scanResult.summary.critical}`);
  console.log(`    ${styles.major('● Majeurs:')} ${scanResult.summary.major}`);
  console.log(`    ${styles.minor('● Mineurs:')} ${scanResult.summary.minor}`);
  console.log();
  
  if (options.verbose && scanResult.issues.length > 0) {
    console.log(styles.info('    Détails des problèmes:'));
    const grouped = new Map<string, ScanIssue[]>();
    for (const issue of scanResult.issues.slice(0, 20)) {
      const existing = grouped.get(issue.file) || [];
      existing.push(issue);
      grouped.set(issue.file, existing);
    }
    
    for (const [file, fileIssues] of grouped) {
      console.log(`    ${styles.file(file)}`);
      for (const issue of fileIssues) {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🔵';
        console.log(`      ${icon} L${issue.line}: ${styles.code(issue.matched)}`);
      }
    }
    console.log();
  }
  
  // Interactive confirmation
  if (options.interactive && !options.dryRun) {
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Continuer avec la libération?',
      default: true,
    }]);
    
    if (!proceed) {
      console.log(styles.warning('\n  ⚠️  Libération annulée\n'));
      process.exit(0);
    }
    console.log();
  }
  
  if (options.dryRun) {
    console.log(styles.warning('\n  ⚠️  Mode dry-run: aucune modification effectuée\n'));
    return;
  }
  
  // ─────────────────────────────────────────────────────────────
  // PHASE 3: CLEAN
  // ─────────────────────────────────────────────────────────────
  
  showStep(3, TOTAL_STEPS, 'Nettoyage des patterns propriétaires', 'running');
  const cleanSpinner = ora({ text: 'Cleaning...', indent: 4 }).start();
  
  const cleanResult = cleanProject(absolutePath, outputPath, scanResult, cleanSpinner);
  
  cleanSpinner.succeed(`${cleanResult.filesCleaned} fichiers nettoyés, ${cleanResult.filesRemoved} fichiers supprimés`);
  
  // ─────────────────────────────────────────────────────────────
  // PHASE 4: REBUILD
  // ─────────────────────────────────────────────────────────────
  
  showStep(4, TOTAL_STEPS, 'Reconstruction de l\'architecture', 'running');
  const rebuildSpinner = ora({ text: 'Rebuilding...', indent: 4 }).start();
  
  const rebuildResult = rebuildProject(outputPath, projectName, rebuildSpinner);
  
  rebuildSpinner.succeed(`${rebuildResult.structure.length} fichiers générés`);
  
  // ─────────────────────────────────────────────────────────────
  // PHASE 5: ZIP
  // ─────────────────────────────────────────────────────────────
  
  let zipPath = '';
  if (!options.noZip) {
    showStep(5, TOTAL_STEPS, 'Création de l\'archive', 'running');
    const zipSpinner = ora({ text: 'Zipping...', indent: 4 }).start();
    
    zipPath = await zipProject(outputPath, projectName, zipSpinner);
    const zipSize = statSync(zipPath).size;
    
    zipSpinner.succeed(`Archive créée (${(zipSize / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    showStep(5, TOTAL_STEPS, 'Création de l\'archive', 'done');
    console.log(styles.info('    Skipped (--no-zip)'));
  }
  
  // ─────────────────────────────────────────────────────────────
  // PHASE 6: EXPORT
  // ─────────────────────────────────────────────────────────────
  
  showStep(6, TOTAL_STEPS, 'Finalisation de l\'export', 'running');
  const exportSpinner = ora({ text: 'Exporting...', indent: 4 }).start();
  
  // Generate README
  const readme = `# ${projectName}

> Projet libéré par InoPay Liberator CLI v${VERSION}

## 🚀 Déploiement rapide

\`\`\`bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
\`\`\`

## 📊 Rapport de libération

- **Score original:** ${scanResult.score}/100 (${scanResult.grade})
- **Fichiers nettoyés:** ${cleanResult.filesCleaned}
- **Fichiers supprimés:** ${cleanResult.filesRemoved}
- **Lignes supprimées:** ${cleanResult.linesRemoved}

## 📁 Structure

\`\`\`
${projectName}/
├── Dockerfile
├── docker-compose.yml
├── inopay.config.json
├── docker/
│   └── nginx.conf
├── scripts/
│   └── deploy.sh
└── src/
\`\`\`

---
*Libéré avec ❤️ par InoPay*
`;
  writeFileSync(join(outputPath, 'README.md'), readme);
  
  // Generate liberation report
  const report = {
    version: VERSION,
    liberatedAt: new Date().toISOString(),
    source: absolutePath,
    output: outputPath,
    scan: {
      totalFiles: scanResult.totalFiles,
      totalLines: scanResult.totalLines,
      score: scanResult.score,
      grade: scanResult.grade,
      issues: scanResult.summary,
    },
    clean: {
      filesProcessed: cleanResult.filesProcessed,
      filesCleaned: cleanResult.filesCleaned,
      filesRemoved: cleanResult.filesRemoved,
      linesRemoved: cleanResult.linesRemoved,
    },
    duration: Date.now() - startTime,
  };
  writeFileSync(join(outputPath, 'liberation-report.json'), JSON.stringify(report, null, 2));
  
  exportSpinner.succeed('Export terminé');
  
  // ─────────────────────────────────────────────────────────────
  // RÉSUMÉ FINAL
  // ─────────────────────────────────────────────────────────────
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log();
  console.log(styles.success(`  ✅ LIBÉRATION TERMINÉE EN ${duration}s`));
  console.log();
  
  drawBox('RÉSUMÉ', [
    `📂 Projet: ${projectName}`,
    `📊 Score: ${scanResult.score}/100 (${scanResult.grade})`,
    `📝 Fichiers traités: ${cleanResult.filesProcessed}`,
    `🧹 Fichiers nettoyés: ${cleanResult.filesCleaned}`,
    `🗑️  Fichiers supprimés: ${cleanResult.filesRemoved}`,
    `📦 Archive: ${zipPath ? basename(zipPath) : 'Non créée'}`,
  ]);
  
  console.log();
  console.log(styles.info('  📋 Prochaines étapes:'));
  console.log(styles.info(`     1. cd ${relative(process.cwd(), outputPath)}`));
  console.log(styles.info('     2. docker compose up -d'));
  console.log(styles.info('     3. Ouvrir http://localhost'));
  console.log();
}

// ═══════════════════════════════════════════════════════════════
// COMMANDE: AUDIT
// ═══════════════════════════════════════════════════════════════

async function auditCommand(projectPath: string, options: { format: string; verbose: boolean }) {
  showBanner();
  
  const absolutePath = join(process.cwd(), projectPath);
  
  if (!existsSync(absolutePath)) {
    console.log(styles.error(`\n  ❌ Le projet n'existe pas: ${projectPath}\n`));
    process.exit(1);
  }
  
  const spinner = ora('Analyse en cours...').start();
  const result = scanProject(absolutePath, spinner);
  spinner.succeed('Analyse terminée');
  
  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  // Text format
  console.log();
  const gradeColor = getGradeColor(result.grade);
  
  drawBox('RAPPORT D\'AUDIT', [
    `Score: ${gradeColor(result.score + '/100')} ${gradeColor('(' + result.grade + ')')}`,
    `Fichiers: ${result.totalFiles.toLocaleString()}`,
    `Lignes: ${result.totalLines.toLocaleString()}`,
    '',
    `🔴 Critiques: ${result.summary.critical}`,
    `🟡 Majeurs: ${result.summary.major}`,
    `🔵 Mineurs: ${result.summary.minor}`,
  ]);
  
  if (result.proprietaryFiles.length > 0) {
    console.log();
    console.log(styles.critical('  🚨 Fichiers propriétaires détectés:'));
    for (const file of result.proprietaryFiles) {
      console.log(styles.file(`     - ${file}`));
    }
  }
  
  if (options.verbose && result.issues.length > 0) {
    console.log();
    console.log(styles.warning('  ⚠️  Problèmes détectés:'));
    
    for (const issue of result.issues.slice(0, 30)) {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🔵';
      console.log(`     ${icon} ${styles.file(issue.file)}:${issue.line}`);
      console.log(`        ${styles.code(issue.matched)}`);
      console.log(`        → ${styles.info(issue.suggestion)}`);
    }
    
    if (result.issues.length > 30) {
      console.log(styles.dim(`     ... et ${result.issues.length - 30} autres`));
    }
  }
  
  console.log();
  
  if (result.score >= 80) {
    console.log(styles.success('  ✅ Projet prêt pour une libération rapide'));
  } else if (result.score >= 60) {
    console.log(styles.warning('  ⚠️  Nettoyage modéré requis'));
  } else {
    console.log(styles.error('  🚨 Nettoyage complet requis'));
  }
  
  console.log(styles.dim('\n  Utilisez `inopay liberate <path>` pour libérer automatiquement\n'));
}

// ═══════════════════════════════════════════════════════════════
// COMMANDE: SCAN
// ═══════════════════════════════════════════════════════════════

async function scanCommand(projectPath: string, options: { format: string }) {
  const absolutePath = join(process.cwd(), projectPath);
  
  if (!existsSync(absolutePath)) {
    console.log(styles.error(`\n  ❌ Le projet n'existe pas: ${projectPath}\n`));
    process.exit(1);
  }
  
  const spinner = ora('Scan rapide...').start();
  const result = scanProject(absolutePath, spinner);
  spinner.stop();
  
  if (options.format === 'json') {
    console.log(JSON.stringify({
      issues: result.issues,
      proprietaryFiles: result.proprietaryFiles,
      score: result.score,
    }, null, 2));
    return;
  }
  
  // Compact output
  const gradeColor = getGradeColor(result.grade);
  console.log(`${gradeColor(result.score + '/100')} | 🔴 ${result.summary.critical} | 🟡 ${result.summary.major} | 🔵 ${result.summary.minor}`);
}

// ═══════════════════════════════════════════════════════════════
// COMMANDE: SERVE
// ═══════════════════════════════════════════════════════════════

async function serveCommand(options: { port: number }) {
  showBanner();
  
  console.log(styles.warning('  🚧 Dashboard local en développement...'));
  console.log(styles.info(`     Le serveur sera disponible sur http://localhost:${options.port}`));
  console.log(styles.info('\n     En attendant, utilisez: https://inopay.app/dashboard\n'));
}

// ═══════════════════════════════════════════════════════════════
// PROGRAMME PRINCIPAL
// ═══════════════════════════════════════════════════════════════

const program = new Command();

program
  .name('inopay')
  .description(chalk.cyan('InoPay Liberator CLI') + chalk.dim(' - Libérez vos projets propriétaires'))
  .version(VERSION, '-v, --version');

program
  .command('liberate <path>')
  .description('Libération complète: scan → audit → clean → rebuild → zip → export')
  .option('-o, --output <path>', 'Dossier de sortie')
  .option('-d, --dry-run', 'Simulation sans modification', false)
  .option('-V, --verbose', 'Afficher les détails', false)
  .option('--no-zip', 'Ne pas créer d\'archive')
  .option('-i, --interactive', 'Mode interactif avec confirmations', false)
  .action(liberateCommand);

program
  .command('audit <path>')
  .description('Analyse un projet et génère un rapport')
  .option('-f, --format <format>', 'Format: text, json', 'text')
  .option('-V, --verbose', 'Afficher tous les problèmes', false)
  .action(auditCommand);

program
  .command('scan <path>')
  .description('Scan rapide des patterns (sortie compacte)')
  .option('-f, --format <format>', 'Format: text, json', 'text')
  .action(scanCommand);

program
  .command('serve')
  .description('Lance le dashboard local')
  .option('-p, --port <port>', 'Port du serveur', (v) => parseInt(v, 10), 3000)
  .action(serveCommand);

// Help customization
program.addHelpText('after', `
${chalk.dim('Exemples:')}
  ${chalk.cyan('$')} inopay liberate ./my-project
  ${chalk.cyan('$')} inopay liberate ./my-project -o ./output --verbose
  ${chalk.cyan('$')} inopay audit ./my-project --format json
  ${chalk.cyan('$')} inopay scan ./my-project

${chalk.dim('Plus d\'infos:')} ${chalk.underline('https://inopay.app/cli')}
`);

program.parse();
