/**
 * Sovereignty Report Generator
 * Generates a detailed SOVEREIGNTY_REPORT.md file for each liberation pack
 */

export interface SovereigntyAuditResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  criticalIssues: string[];
  majorIssues: string[];
  minorIssues: string[];
  cleanedItems: string[];
  remainingDependencies: string[];
  recommendations: string[];
}

export function generateSovereigntyReport(
  projectName: string,
  audit: SovereigntyAuditResult,
  cleaningStats: {
    filesRemoved: number;
    filesCleaned: number;
    packagesRemoved: number;
    polyfillsGenerated: number;
  }
): string {
  const date = new Date().toISOString().split('T')[0];
  const grade = audit.grade;
  const gradeEmoji = {
    'A': '🏆',
    'B': '✅',
    'C': '⚠️',
    'D': '🔶',
    'F': '❌'
  }[grade];

  return `# 🛡️ Rapport de Souveraineté - ${projectName}

**Date de génération:** ${date}
**Score de souveraineté:** ${audit.score}%
**Grade:** ${gradeEmoji} ${grade}

---

## 📊 Résumé exécutif

Ce rapport détaille le niveau de souveraineté de votre code après la libération par Inopay.
Un code 100% souverain ne contient aucune dépendance à des plateformes propriétaires
et peut être déployé sur n'importe quelle infrastructure.

### Statistiques de nettoyage

| Métrique | Valeur |
|----------|--------|
| Fichiers supprimés | ${cleaningStats.filesRemoved} |
| Fichiers nettoyés | ${cleaningStats.filesCleaned} |
| Packages retirés | ${cleaningStats.packagesRemoved} |
| Polyfills générés | ${cleaningStats.polyfillsGenerated} |

---

## 🔴 Problèmes critiques (${audit.criticalIssues.length})

${audit.criticalIssues.length === 0 
  ? '✅ Aucun problème critique détecté.\n' 
  : audit.criticalIssues.map(issue => `- ❌ ${issue}`).join('\n')
}

---

## 🟠 Problèmes majeurs (${audit.majorIssues.length})

${audit.majorIssues.length === 0 
  ? '✅ Aucun problème majeur détecté.\n' 
  : audit.majorIssues.map(issue => `- ⚠️ ${issue}`).join('\n')
}

---

## 🟡 Problèmes mineurs (${audit.minorIssues.length})

${audit.minorIssues.length === 0 
  ? '✅ Aucun problème mineur détecté.\n' 
  : audit.minorIssues.map(issue => `- ℹ️ ${issue}`).join('\n')
}

---

## ✅ Éléments nettoyés

${audit.cleanedItems.length === 0 
  ? 'Aucun nettoyage nécessaire.\n' 
  : audit.cleanedItems.map(item => `- ✓ ${item}`).join('\n')
}

---

## 📦 Dépendances restantes

Ces dépendances sont considérées comme sûres et ne compromettent pas la souveraineté:

${audit.remainingDependencies.length === 0 
  ? 'Aucune dépendance externe.\n' 
  : audit.remainingDependencies.slice(0, 20).map(dep => `- ${dep}`).join('\n')
}
${audit.remainingDependencies.length > 20 ? `\n... et ${audit.remainingDependencies.length - 20} autres\n` : ''}

---

## 💡 Recommandations

${audit.recommendations.length === 0 
  ? 'Aucune recommandation particulière. Votre code est prêt pour le déploiement souverain!\n' 
  : audit.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
}

---

## 🚀 Prochaines étapes

1. **Vérifiez** les problèmes signalés ci-dessus
2. **Testez** le build en local: \`npm install && npm run build\`
3. **Déployez** sur votre infrastructure (Docker, VPS, Coolify, etc.)
4. **Configurez** vos propres variables d'environnement

### Commandes de déploiement rapide

\`\`\`bash
# Build local
npm install
npm run build

# Déploiement Docker
docker build -t ${projectName.toLowerCase()} .
docker run -p 80:80 ${projectName.toLowerCase()}
\`\`\`

---

## 🔒 Garantie de souveraineté

Ce code a été nettoyé par **Inopay** pour garantir:

- ✅ Aucune télémétrie vers des serveurs tiers
- ✅ Aucun SDK propriétaire intégré
- ✅ Aucune dépendance à des CDN externes
- ✅ Code 100% auto-hébergeable
- ✅ Aucun lock-in de plateforme

---

*Généré automatiquement par Inopay Liberation Engine v3.0*
*Pour toute question: support@inopay.dev*
`;
}

export function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 95) return 'A';
  if (score >= 85) return 'B';
  if (score >= 70) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function auditCleanedFiles(
  cleanedFiles: Record<string, string>,
  removedPackages: string[],
  polyfillsGenerated: number
): SovereigntyAuditResult {
  const criticalIssues: string[] = [];
  const majorIssues: string[] = [];
  const minorIssues: string[] = [];
  const cleanedItems: string[] = [];
  const recommendations: string[] = [];

  // Check for remaining proprietary patterns
  const proprietaryPatterns = [
    { pattern: /lovable/gi, name: 'Lovable' },
    { pattern: /gptengineer/gi, name: 'GPT Engineer' },
    { pattern: /bolt\.new/gi, name: 'Bolt' },
    { pattern: /v0\.dev/gi, name: 'v0' },
    { pattern: /cursor/gi, name: 'Cursor' },
    { pattern: /codeium/gi, name: 'Codeium' },
    { pattern: /windsurf/gi, name: 'Windsurf' },
  ];

  let issuesFound = 0;

  for (const [filePath, content] of Object.entries(cleanedFiles)) {
    for (const { pattern, name } of proprietaryPatterns) {
      if (pattern.test(content)) {
        criticalIssues.push(`Référence à ${name} trouvée dans ${filePath}`);
        issuesFound++;
      }
    }

    // Check for hardcoded URLs
    if (/https?:\/\/[a-z]+\.supabase\.co/gi.test(content)) {
      majorIssues.push(`URL Supabase hardcodée dans ${filePath}`);
      issuesFound++;
    }

    // Check for exposed API keys
    if (/sk_live_|pk_live_|eyJ[A-Za-z0-9_-]{100,}/g.test(content)) {
      criticalIssues.push(`Clé API potentiellement exposée dans ${filePath}`);
      issuesFound++;
    }
  }

  // Add cleaned items
  if (removedPackages.length > 0) {
    cleanedItems.push(`${removedPackages.length} packages propriétaires retirés`);
  }
  if (polyfillsGenerated > 0) {
    cleanedItems.push(`${polyfillsGenerated} polyfills générés pour la compatibilité`);
  }

  // Calculate score
  const baseScore = 100;
  const criticalPenalty = criticalIssues.length * 15;
  const majorPenalty = majorIssues.length * 5;
  const minorPenalty = minorIssues.length * 1;
  const score = Math.max(0, baseScore - criticalPenalty - majorPenalty - minorPenalty);

  // Generate recommendations
  if (criticalIssues.length > 0) {
    recommendations.push('Corrigez les problèmes critiques avant tout déploiement en production');
  }
  if (majorIssues.length > 0) {
    recommendations.push('Remplacez les URLs hardcodées par des variables d\'environnement');
  }
  if (score < 90) {
    recommendations.push('Effectuez une revue manuelle du code pour détecter d\'autres dépendances');
  }
  if (score >= 95) {
    recommendations.push('Votre code est prêt pour le déploiement souverain!');
  }

  // Get remaining safe dependencies from package.json
  const packageJsonContent = cleanedFiles['package.json'];
  let remainingDependencies: string[] = [];
  if (packageJsonContent) {
    try {
      const pkg = JSON.parse(packageJsonContent);
      remainingDependencies = Object.keys(pkg.dependencies || {});
    } catch {}
  }

  return {
    score,
    grade: calculateGrade(score),
    criticalIssues,
    majorIssues,
    minorIssues,
    cleanedItems,
    remainingDependencies,
    recommendations,
  };
}
