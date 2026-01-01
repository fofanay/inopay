/**
 * INOPAY LIBERATOR CORE ENGINE
 * ============================
 * Moteur central de libération de projets
 * Scan, Audit, Nettoyage, Génération de packages souverains
 * 
 * © 2024 Inovaq Canada Inc.
 */

// ============= Types =============

export interface LiberationOptions {
  removeProprietaryImports: boolean;
  removeProprietaryFiles: boolean;
  removeTelemetry: boolean;
  replaceSuspiciousPackages: boolean;
  generatePolyfills: boolean;
  includeDockerConfig: boolean;
  includeDeployGuide: boolean;
}

export interface ScanResult {
  totalFiles: number;
  totalLines: number;
  proprietaryImports: Array<{ file: string; import: string; line: number }>;
  proprietaryFiles: string[];
  telemetryDomains: Array<{ file: string; domain: string }>;
  suspiciousPackages: string[];
  exposedSecrets: Array<{ file: string; type: string; line: number }>;
  platformDetected: string;
}

export interface AuditIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: string;
  file?: string;
  line?: number;
  message: string;
  solution: string;
}

export interface AuditReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: {
    critical: AuditIssue[];
    major: AuditIssue[];
    minor: AuditIssue[];
    info: AuditIssue[];
  };
  recommendations: string[];
  owaspScore: number;
  sovereigntyScore: number;
  summary: {
    totalIssues: number;
    filesAffected: number;
    estimatedCleanTime: number; // en minutes
  };
}

export interface CleaningResult {
  originalFile: string;
  cleanedContent: string;
  changes: Array<{
    type: 'removed' | 'replaced' | 'added';
    line: number;
    description: string;
  }>;
  removed: boolean;
}

export interface LiberationPack {
  files: Record<string, string>;
  manifest: SovereigntyManifest;
  stats: {
    filesTotal: number;
    filesRemoved: number;
    filesCleaned: number;
    linesRemoved: number;
    packagesRemoved: string[];
    polyfillsGenerated: number;
  };
}

export interface SovereigntyManifest {
  version: string;
  generatedAt: string;
  projectName: string;
  auditScore: number;
  sovereigntyGrade: string;
  checksum: string;
  files: { path: string; hash: string }[];
}

// ============= Patterns de détection =============

const PROPRIETARY_IMPORT_PATTERNS = [
  /@lovable\//i,
  /lovable-tagger/i,
  /@agent\//i,
  /getAIAssistant/i,
  /lovableApi/i,
  /Pattern\.\w+/i,
  /EventSchema\.\w+/i,
  /@supabase\/ui/i,
  /__lovable__/i,
  /lovable\.generate/i,
  /cloudflare-ai/i,
  /@anthropic-ai\/sdk/i,
  /openai(?!-compatible)/i,
];

const PROPRIETARY_FILES = [
  'lovable.config',
  '.lovable',
  'lovable-lock',
  '.agent',
  'agent.config',
  '__lovable__',
  'lovable.json',
  '.bolt',
  'bolt.config',
];

const TELEMETRY_DOMAINS = [
  'lovable.dev/api',
  'api.lovable.dev',
  'telemetry.lovable',
  'analytics.lovable',
  'sentry.io',
  'amplitude.com',
  'mixpanel.com',
  'segment.io',
  'hotjar.com',
  'fullstory.com',
  'logrocket.com',
];

const SUSPICIOUS_PACKAGES = [
  'lovable-tagger',
  '@lovable/',
  '@agent/',
  'anthropic',
  'openai',
  '@anthropic-ai/sdk',
  'cloudflare-ai',
  'replicate',
  'huggingface',
];

const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, type: 'OpenAI API Key' },
  { pattern: /sk-ant-[a-zA-Z0-9]{20,}/g, type: 'Anthropic API Key' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'GitHub Token' },
  { pattern: /xoxb-[a-zA-Z0-9-]+/g, type: 'Slack Bot Token' },
  { pattern: /sk_live_[a-zA-Z0-9]+/g, type: 'Stripe Live Key' },
  { pattern: /AKIA[A-Z0-9]{16}/g, type: 'AWS Access Key' },
];

// ============= Classe LiberatorEngine =============

export class LiberatorEngine {
  private options: LiberationOptions;

  constructor(options?: Partial<LiberationOptions>) {
    this.options = {
      removeProprietaryImports: true,
      removeProprietaryFiles: true,
      removeTelemetry: true,
      replaceSuspiciousPackages: true,
      generatePolyfills: true,
      includeDockerConfig: true,
      includeDeployGuide: true,
      ...options,
    };
  }

  /**
   * Phase 1: Scan du projet
   */
  scan(files: Record<string, string>): ScanResult {
    const result: ScanResult = {
      totalFiles: Object.keys(files).length,
      totalLines: 0,
      proprietaryImports: [],
      proprietaryFiles: [],
      telemetryDomains: [],
      suspiciousPackages: [],
      exposedSecrets: [],
      platformDetected: 'unknown',
    };

    // Détection de la plateforme
    if (files['lovable.config.json'] || files['.lovable']) {
      result.platformDetected = 'lovable';
    } else if (files['.bolt'] || files['bolt.config.json']) {
      result.platformDetected = 'bolt';
    } else if (files['.cursor'] || files['cursor.config.json']) {
      result.platformDetected = 'cursor';
    }

    for (const [path, content] of Object.entries(files)) {
      // Compter les lignes
      const lines = content.split('\n');
      result.totalLines += lines.length;

      // Détecter fichiers propriétaires
      const filename = path.split('/').pop() || '';
      if (PROPRIETARY_FILES.some(pf => filename.toLowerCase().includes(pf.toLowerCase()))) {
        result.proprietaryFiles.push(path);
      }

      // Détecter imports propriétaires
      lines.forEach((line, index) => {
        for (const pattern of PROPRIETARY_IMPORT_PATTERNS) {
          if (pattern.test(line)) {
            result.proprietaryImports.push({
              file: path,
              import: line.trim(),
              line: index + 1,
            });
            break;
          }
        }
      });

      // Détecter télémétrie
      for (const domain of TELEMETRY_DOMAINS) {
        if (content.includes(domain)) {
          result.telemetryDomains.push({ file: path, domain });
        }
      }

      // Détecter secrets exposés
      for (const { pattern, type } of SECRET_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              result.exposedSecrets.push({ file: path, type, line: i + 1 });
            }
          }
        }
      }

      // Détecter packages suspects dans package.json
      if (path.endsWith('package.json')) {
        try {
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          for (const dep of Object.keys(deps)) {
            if (SUSPICIOUS_PACKAGES.some(sp => dep.includes(sp))) {
              result.suspiciousPackages.push(dep);
            }
          }
        } catch {
          // JSON invalide
        }
      }
    }

    return result;
  }

  /**
   * Phase 2: Génération du rapport d'audit
   */
  audit(scanResult: ScanResult): AuditReport {
    const issues: AuditReport['issues'] = {
      critical: [],
      major: [],
      minor: [],
      info: [],
    };

    // Issues critiques
    for (const secret of scanResult.exposedSecrets) {
      issues.critical.push({
        id: `secret-${secret.file}-${secret.line}`,
        severity: 'critical',
        category: 'Sécurité',
        file: secret.file,
        line: secret.line,
        message: `Secret exposé: ${secret.type}`,
        solution: 'Supprimer le secret et utiliser des variables d\'environnement',
      });
    }

    // Issues majeures
    for (const imp of scanResult.proprietaryImports) {
      issues.major.push({
        id: `import-${imp.file}-${imp.line}`,
        severity: 'major',
        category: 'Dépendance Propriétaire',
        file: imp.file,
        line: imp.line,
        message: `Import propriétaire: ${imp.import.substring(0, 80)}`,
        solution: 'Remplacer par un équivalent open-source ou supprimer',
      });
    }

    for (const file of scanResult.proprietaryFiles) {
      issues.major.push({
        id: `file-${file}`,
        severity: 'major',
        category: 'Fichier Propriétaire',
        file,
        message: `Fichier de configuration propriétaire`,
        solution: 'Supprimer ce fichier du projet',
      });
    }

    for (const pkg of scanResult.suspiciousPackages) {
      issues.major.push({
        id: `package-${pkg}`,
        severity: 'major',
        category: 'Package Suspect',
        message: `Package propriétaire/cloud: ${pkg}`,
        solution: 'Remplacer par une alternative open-source ou supprimer',
      });
    }

    // Issues mineures
    for (const tel of scanResult.telemetryDomains) {
      issues.minor.push({
        id: `telemetry-${tel.file}-${tel.domain}`,
        severity: 'minor',
        category: 'Télémétrie',
        file: tel.file,
        message: `Domaine de télémétrie: ${tel.domain}`,
        solution: 'Supprimer ou remplacer par une solution auto-hébergée',
      });
    }

    // Info
    issues.info.push({
      id: 'platform-detected',
      severity: 'info',
      category: 'Plateforme',
      message: `Plateforme détectée: ${scanResult.platformDetected}`,
      solution: 'Information pour référence',
    });

    // Calcul des scores
    const totalIssues = issues.critical.length + issues.major.length + issues.minor.length;
    const criticalWeight = issues.critical.length * 25;
    const majorWeight = issues.major.length * 10;
    const minorWeight = issues.minor.length * 2;
    
    const rawScore = 100 - criticalWeight - majorWeight - minorWeight;
    const score = Math.max(0, Math.min(100, rawScore));
    
    const grade = this.calculateGrade(score);
    const owaspScore = issues.critical.length === 0 ? Math.min(100, score + 10) : score - 20;
    const sovereigntyScore = 100 - (scanResult.proprietaryImports.length * 5) - (scanResult.suspiciousPackages.length * 10);

    // Recommandations
    const recommendations: string[] = [];
    
    if (issues.critical.length > 0) {
      recommendations.push('🚨 URGENT: Supprimer tous les secrets exposés immédiatement');
    }
    if (scanResult.proprietaryImports.length > 0) {
      recommendations.push('Remplacer les imports propriétaires par des alternatives open-source');
    }
    if (scanResult.suspiciousPackages.length > 0) {
      recommendations.push('Migrer vers des packages IA souverains (Ollama, LMStudio)');
    }
    if (scanResult.telemetryDomains.length > 0) {
      recommendations.push('Remplacer la télémétrie par une solution auto-hébergée (Plausible, Umami)');
    }
    if (score < 80) {
      recommendations.push('Effectuer un nettoyage complet avant déploiement');
    }

    const filesAffected = new Set([
      ...scanResult.proprietaryImports.map(i => i.file),
      ...scanResult.proprietaryFiles,
      ...scanResult.telemetryDomains.map(t => t.file),
      ...scanResult.exposedSecrets.map(s => s.file),
    ]).size;

    return {
      score,
      grade,
      issues,
      recommendations,
      owaspScore: Math.max(0, Math.min(100, owaspScore)),
      sovereigntyScore: Math.max(0, Math.min(100, sovereigntyScore)),
      summary: {
        totalIssues,
        filesAffected,
        estimatedCleanTime: Math.ceil(totalIssues * 0.5), // ~30 sec par issue
      },
    };
  }

  /**
   * Phase 3: Nettoyage des fichiers
   */
  clean(files: Record<string, string>): Map<string, CleaningResult> {
    const results = new Map<string, CleaningResult>();

    for (const [path, content] of Object.entries(files)) {
      const result = this.cleanFile(path, content);
      results.set(path, result);
    }

    return results;
  }

  /**
   * Phase 4: Génération du package de libération
   */
  generate(
    cleanedFiles: Map<string, CleaningResult>,
    projectName: string
  ): LiberationPack {
    const files: Record<string, string> = {};
    let filesRemoved = 0;
    let filesCleaned = 0;
    let linesRemoved = 0;
    const packagesRemoved: string[] = [];
    let polyfillsGenerated = 0;

    // Collecter les fichiers nettoyés
    for (const [path, result] of cleanedFiles.entries()) {
      if (result.removed) {
        filesRemoved++;
      } else {
        files[path] = result.cleanedContent;
        if (result.changes.length > 0) {
          filesCleaned++;
          linesRemoved += result.changes.filter(c => c.type === 'removed').length;
        }
      }
    }

    // Ajouter les fichiers Docker si demandé
    if (this.options.includeDockerConfig) {
      files['Dockerfile'] = this.generateDockerfile();
      files['docker-compose.yml'] = this.generateDockerCompose(projectName);
      files['.dockerignore'] = this.generateDockerignore();
    }

    // Ajouter le guide de déploiement
    if (this.options.includeDeployGuide) {
      files['DEPLOY.md'] = this.generateDeployGuide(projectName);
    }

    // Générer le manifeste
    const manifest = this.generateManifest(projectName, files);

    return {
      files,
      manifest,
      stats: {
        filesTotal: Object.keys(files).length,
        filesRemoved,
        filesCleaned,
        linesRemoved,
        packagesRemoved,
        polyfillsGenerated,
      },
    };
  }

  // ============= Méthodes privées =============

  private cleanFile(path: string, content: string): CleaningResult {
    const changes: CleaningResult['changes'] = [];
    let cleanedContent = content;
    let removed = false;

    // Vérifier si le fichier doit être supprimé
    const filename = path.split('/').pop() || '';
    if (this.options.removeProprietaryFiles) {
      if (PROPRIETARY_FILES.some(pf => filename.toLowerCase().includes(pf.toLowerCase()))) {
        return { originalFile: path, cleanedContent: '', changes: [], removed: true };
      }
    }

    const lines = cleanedContent.split('\n');
    const cleanedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let shouldKeep = true;

      // Supprimer imports propriétaires
      if (this.options.removeProprietaryImports) {
        for (const pattern of PROPRIETARY_IMPORT_PATTERNS) {
          if (pattern.test(line)) {
            changes.push({
              type: 'removed',
              line: i + 1,
              description: 'Import propriétaire supprimé',
            });
            shouldKeep = false;
            break;
          }
        }
      }

      // Supprimer télémétrie
      if (shouldKeep && this.options.removeTelemetry) {
        for (const domain of TELEMETRY_DOMAINS) {
          if (line.includes(domain)) {
            line = line.replace(new RegExp(domain.replace(/\./g, '\\.'), 'g'), '/* removed */');
            changes.push({
              type: 'replaced',
              line: i + 1,
              description: `Télémétrie supprimée: ${domain}`,
            });
          }
        }
      }

      // Supprimer secrets
      for (const { pattern, type } of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          line = line.replace(pattern, `/* ${type} REMOVED */`);
          changes.push({
            type: 'replaced',
            line: i + 1,
            description: `Secret masqué: ${type}`,
          });
        }
      }

      if (shouldKeep) {
        cleanedLines.push(line);
      }
    }

    cleanedContent = cleanedLines.join('\n');

    // Nettoyer package.json
    if (path.endsWith('package.json') && this.options.replaceSuspiciousPackages) {
      try {
        const pkg = JSON.parse(cleanedContent);
        const removedDeps: string[] = [];
        
        for (const section of ['dependencies', 'devDependencies']) {
          if (pkg[section]) {
            for (const dep of Object.keys(pkg[section])) {
              if (SUSPICIOUS_PACKAGES.some(sp => dep.includes(sp))) {
                delete pkg[section][dep];
                removedDeps.push(dep);
              }
            }
          }
        }

        if (removedDeps.length > 0) {
          cleanedContent = JSON.stringify(pkg, null, 2);
          changes.push({
            type: 'removed',
            line: 0,
            description: `Packages supprimés: ${removedDeps.join(', ')}`,
          });
        }
      } catch {
        // JSON invalide, on garde tel quel
      }
    }

    return {
      originalFile: path,
      cleanedContent,
      changes,
      removed,
    };
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateDockerfile(): string {
    return `# INOPAY Liberation Pack - Dockerfile
# Auto-généré par Inopay Liberator Engine

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerCompose(projectName: string): string {
    const serviceName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `# INOPAY Liberation Pack - Docker Compose
# Auto-généré par Inopay Liberator Engine

version: '3.8'

services:
  ${serviceName}:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
    environment:
      - NODE_ENV=production

  # Base de données (optionnel)
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: \${POSTGRES_DB:-app}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
`;
  }

  private generateDockerignore(): string {
    return `node_modules
.git
.env
.env.local
*.log
dist
.DS_Store
coverage
.nyc_output
`;
  }

  private generateDeployGuide(projectName: string): string {
    return `# 🚀 Guide de Déploiement - ${projectName}

## Package Libéré par Inopay Liberator Engine

Ce projet a été libéré et est maintenant 100% souverain.

## Prérequis
- Docker & Docker Compose
- VPS Ubuntu 22.04+ (recommandé)

## Déploiement Rapide

\`\`\`bash
# 1. Configuration
cp .env.example .env
nano .env  # Éditez vos variables

# 2. Lancement
docker compose up -d

# 3. Vérification
docker compose ps
curl http://localhost
\`\`\`

## Structure du Package
- \`Dockerfile\` - Configuration Docker
- \`docker-compose.yml\` - Orchestration des services
- \`src/\` - Code source nettoyé
- \`DEPLOY.md\` - Ce guide

## Support
- Documentation: https://inopay.app/docs
- Contact: support@inopay.app

---
*Généré par Inopay Liberator Engine v1.0*
`;
  }

  private generateManifest(projectName: string, files: Record<string, string>): SovereigntyManifest {
    const timestamp = new Date().toISOString();
    const filesList = Object.entries(files).map(([path, content]) => ({
      path,
      hash: this.simpleHash(content),
    }));
    
    const checksum = this.simpleHash(JSON.stringify(filesList) + timestamp);

    return {
      version: '1.0.0',
      generatedAt: timestamp,
      projectName,
      auditScore: 100,
      sovereigntyGrade: 'A',
      checksum,
      files: filesList,
    };
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ============= Export par défaut =============

export default LiberatorEngine;
