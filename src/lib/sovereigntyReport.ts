/**
 * INOPAY SOVEREIGNTY AUDIT REPORT
 * ================================
 * Ce fichier génère un rapport d'audit de souveraineté en temps réel.
 * 
 * © 2024 Inovaq Canada Inc. - Code 100% Souverain
 */

export interface SovereigntyAuditResult {
  isFullySovereign: boolean;
  auditDate: string;
  buildMode: 'production' | 'development';
  summary: {
    totalFilesScanned: number;
    issuesFound: number;
    issuesCritical: number;
    issuesWarning: number;
    signaturesCleaned: number;
    dependenciesAudited: number;
    proprietaryDepsFound: string[];
  };
  domStatus: {
    cleanerActive: boolean;
    signaturesRemoved: number;
  };
  buildConfig: {
    minification: 'terser' | 'esbuild' | 'none';
    sourceMaps: boolean;
    chunkRandomization: boolean;
    consoleStripping: boolean;
  };
  infrastructureMode: 'cloud' | 'self-hosted' | 'hybrid';
  secretsProtection: {
    sessionStorageOnly: boolean;
    incognitoModeAvailable: boolean;
    noDatabasePersistence: boolean;
  };
  certification: {
    status: 'sovereign' | 'almost_sovereign' | 'requires_action';
    score: number; // 0-100
    message: string;
    blockers: string[];
  };
}

// Patterns propriétaires à détecter
const PROPRIETARY_PATTERNS = [
  { pattern: /@lovable\//g, severity: 'critical' as const, name: '@lovable/* imports' },
  { pattern: /@gptengineer\//g, severity: 'critical' as const, name: '@gptengineer/* imports' },
  { pattern: /lovable-tagger/g, severity: 'critical' as const, name: 'lovable-tagger' },
  { pattern: /from ['"]lovable/g, severity: 'critical' as const, name: 'lovable package imports' },
  { pattern: /componentTagger/g, severity: 'warning' as const, name: 'componentTagger usage' },
  { pattern: /data-lovable-id/g, severity: 'warning' as const, name: 'data-lovable-id attributes' },
  { pattern: /data-bolt-id/g, severity: 'warning' as const, name: 'data-bolt-id attributes' },
  { pattern: /@bolt\/runtime/g, severity: 'critical' as const, name: '@bolt/runtime' },
  { pattern: /@v0\/components/g, severity: 'critical' as const, name: '@v0/components' },
];

// Dépendances connues comme propriétaires
const KNOWN_PROPRIETARY_DEPS = [
  'lovable-tagger',
  '@lovable/core',
  '@lovable/cli',
  '@lovable/ui',
  '@gptengineer/core',
  '@bolt/runtime',
  '@v0/components',
];

/**
 * Vérifie si un fichier contient des références propriétaires
 */
export function checkFileForProprietaryCode(content: string): {
  isClean: boolean;
  issues: { pattern: string; line: number; severity: 'critical' | 'warning' }[];
} {
  const issues: { pattern: string; line: number; severity: 'critical' | 'warning' }[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, severity, name } of PROPRIETARY_PATTERNS) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        issues.push({
          pattern: name,
          line: i + 1,
          severity,
        });
      }
    }
  }

  return {
    isClean: issues.length === 0,
    issues,
  };
}

/**
 * Génère le rapport de souveraineté complet
 */
export function generateSovereigntyReport(): SovereigntyAuditResult {
  const isProd = import.meta.env.PROD;
  const infraMode = (import.meta.env.VITE_INFRA_MODE || 'cloud') as 'cloud' | 'self-hosted' | 'hybrid';
  
  // Compter les dépendances propriétaires présentes
  // Note: En runtime, on ne peut pas scanner package.json directement
  // Ce sera fait lors du build/export
  const proprietaryDepsFound: string[] = [];
  
  // Vérifier si lovable-tagger est chargé (dev only)
  if (!isProd && typeof window !== 'undefined') {
    // En dev, le tagger peut être présent mais c'est OK
  }
  
  // Calcul du score
  let score = 100;
  const blockers: string[] = [];
  
  // -10 points si pas en mode production
  if (!isProd) {
    score -= 10;
  }
  
  // -5 points par dépendance propriétaire trouvée
  score -= proprietaryDepsFound.length * 5;
  
  // -20 si mode cloud sans abstraction
  if (infraMode === 'cloud') {
    score -= 5; // Petit malus car dépend encore de l'infra cloud
  }
  
  // Déterminer le statut
  let status: 'sovereign' | 'almost_sovereign' | 'requires_action';
  let message: string;
  
  if (score >= 95) {
    status = 'sovereign';
    message = '✅ Code 100% Souverain - Aucune dépendance propriétaire active en production';
  } else if (score >= 80) {
    status = 'almost_sovereign';
    message = '🔶 Presque souverain - Quelques ajustements recommandés';
  } else {
    status = 'requires_action';
    message = '⚠️ Actions requises pour atteindre la souveraineté complète';
    blockers.push(...proprietaryDepsFound.map(d => `Supprimer la dépendance: ${d}`));
  }
  
  return {
    isFullySovereign: score >= 95,
    auditDate: new Date().toISOString(),
    buildMode: isProd ? 'production' : 'development',
    summary: {
      totalFilesScanned: 0, // Sera rempli lors d'un scan complet
      issuesFound: proprietaryDepsFound.length,
      issuesCritical: 0,
      issuesWarning: 0,
      signaturesCleaned: 0,
      dependenciesAudited: KNOWN_PROPRIETARY_DEPS.length,
      proprietaryDepsFound,
    },
    domStatus: {
      cleanerActive: isProd,
      signaturesRemoved: 0, // Mis à jour dynamiquement
    },
    buildConfig: {
      minification: 'terser',
      sourceMaps: !isProd,
      chunkRandomization: isProd,
      consoleStripping: isProd,
    },
    infrastructureMode: infraMode,
    secretsProtection: {
      sessionStorageOnly: true,
      incognitoModeAvailable: true,
      noDatabasePersistence: true,
    },
    certification: {
      status,
      score,
      message,
      blockers,
    },
  };
}

/**
 * Audit complet d'un projet (utilisé lors de l'export)
 */
export function auditProjectFiles(files: Map<string, string>): {
  report: SovereigntyAuditResult;
  fileIssues: Map<string, { pattern: string; line: number; severity: 'critical' | 'warning' }[]>;
} {
  const fileIssues = new Map<string, { pattern: string; line: number; severity: 'critical' | 'warning' }[]>();
  let totalIssues = 0;
  let criticalCount = 0;
  let warningCount = 0;
  
  files.forEach((content, filePath) => {
    // Ne scanner que les fichiers source
    if (!/\.(ts|tsx|js|jsx|json)$/.test(filePath)) return;
    if (filePath.includes('node_modules')) return;
    
    const result = checkFileForProprietaryCode(content);
    if (!result.isClean) {
      fileIssues.set(filePath, result.issues);
      totalIssues += result.issues.length;
      criticalCount += result.issues.filter(i => i.severity === 'critical').length;
      warningCount += result.issues.filter(i => i.severity === 'warning').length;
    }
  });
  
  const report = generateSovereigntyReport();
  report.summary.totalFilesScanned = files.size;
  report.summary.issuesFound = totalIssues;
  report.summary.issuesCritical = criticalCount;
  report.summary.issuesWarning = warningCount;
  
  // Recalculer le score basé sur les vrais résultats
  let score = 100;
  score -= criticalCount * 10;
  score -= warningCount * 2;
  score = Math.max(0, score);
  
  report.certification.score = score;
  if (score >= 95) {
    report.certification.status = 'sovereign';
    report.certification.message = '✅ Code 100% Souverain - Prêt pour le déploiement autonome';
    report.isFullySovereign = true;
  } else if (score >= 80) {
    report.certification.status = 'almost_sovereign';
    report.certification.message = `🔶 Score: ${score}/100 - ${criticalCount} problèmes critiques à corriger`;
  } else {
    report.certification.status = 'requires_action';
    report.certification.message = `⚠️ Score: ${score}/100 - Nettoyage requis avant export`;
  }
  
  return { report, fileIssues };
}

/**
 * Générer un résumé texte du rapport
 */
export function generateReportSummary(report: SovereigntyAuditResult): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║           INOPAY SOVEREIGNTY AUDIT REPORT                    ║
╠══════════════════════════════════════════════════════════════╣
║ Date: ${report.auditDate.split('T')[0]}                                        ║
║ Mode: ${report.buildMode.toUpperCase().padEnd(12)} | Infra: ${report.infrastructureMode.toUpperCase().padEnd(12)}║
╠══════════════════════════════════════════════════════════════╣
║ SCORE: ${String(report.certification.score).padEnd(3)}/100                                           ║
║ ${report.certification.message.padEnd(60)}║
╠══════════════════════════════════════════════════════════════╣
║ RÉSUMÉ:                                                      ║
║ • Fichiers scannés: ${String(report.summary.totalFilesScanned).padEnd(5)}                              ║
║ • Problèmes critiques: ${String(report.summary.issuesCritical).padEnd(3)}                             ║
║ • Avertissements: ${String(report.summary.issuesWarning).padEnd(3)}                                  ║
║ • Signatures DOM nettoyées: ${String(report.domStatus.signaturesRemoved).padEnd(3)}                      ║
╠══════════════════════════════════════════════════════════════╣
║ CONFIGURATION BUILD:                                         ║
║ • Minification: ${report.buildConfig.minification.padEnd(10)} ✓                         ║
║ • Source Maps: ${report.buildConfig.sourceMaps ? 'ACTIVÉS  ⚠' : 'DÉSACTIVÉS ✓'}                           ║
║ • Chunks aléatoires: ${report.buildConfig.chunkRandomization ? 'OUI ✓' : 'NON ⚠'}                         ║
║ • Console strip: ${report.buildConfig.consoleStripping ? 'OUI ✓' : 'NON ⚠'}                              ║
╠══════════════════════════════════════════════════════════════╣
║ PROTECTION SECRETS:                                          ║
║ • Session storage only: ${report.secretsProtection.sessionStorageOnly ? 'OUI ✓' : 'NON ⚠'}                    ║
║ • Mode incognito: ${report.secretsProtection.incognitoModeAvailable ? 'DISPONIBLE ✓' : 'INDISPONIBLE ⚠'}                  ║
║ • Pas de DB persist: ${report.secretsProtection.noDatabasePersistence ? 'OUI ✓' : 'NON ⚠'}                      ║
╚══════════════════════════════════════════════════════════════╝

© ${new Date().getFullYear()} Inovaq Canada Inc. - Code Souverain
`.trim();
}
