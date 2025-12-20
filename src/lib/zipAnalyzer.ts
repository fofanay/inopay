import JSZip from "jszip";

// Dictionnaire de détection des patterns propriétaires
const PROPRIETARY_PATTERNS = {
  packages: [
    "@lovable/",
    "@gptengineer/",
    "lovable-tagger",
    "supabase-management",
  ],
  imports: [
    "use-mobile",
    "use-toast",
    "@/hooks/use-mobile",
    "@/hooks/use-toast",
    "@lovable/",
    "@gptengineer/",
  ],
  files: [
    ".lovable",
    ".gptengineer",
    "lovable.config",
    ".bolt",
  ],
};

export interface AnalysisIssue {
  file: string;
  line?: number;
  pattern: string;
  severity: "critical" | "warning" | "info";
  description: string;
}

export interface DependencyItem {
  name: string;
  type: string;
  status: "compatible" | "warning" | "incompatible";
  note: string;
}

export interface RealAnalysisResult {
  score: number;
  platform: string | null;
  totalFiles: number;
  analyzedFiles: number;
  issues: AnalysisIssue[];
  dependencies: DependencyItem[];
  recommendations: string[];
  extractedFiles: Map<string, string>;
}

export type ProgressCallback = (progress: number, message: string) => void;

// Détecter la plateforme à partir des patterns
function detectPlatform(issues: AnalysisIssue[], dependencies: DependencyItem[]): string | null {
  const allPatterns = [
    ...issues.map(i => i.pattern),
    ...dependencies.filter(d => d.status === "incompatible").map(d => d.name),
  ].join(" ").toLowerCase();

  if (allPatterns.includes("lovable") || allPatterns.includes("gptengineer")) {
    return "Lovable";
  }
  if (allPatterns.includes("bolt")) {
    return "Bolt";
  }
  if (allPatterns.includes("v0")) {
    return "v0";
  }
  return null;
}

// Analyser le package.json
function analyzePackageJson(content: string): DependencyItem[] {
  const dependencies: DependencyItem[] = [];
  
  try {
    const pkg = JSON.parse(content);
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    for (const [name, version] of Object.entries(allDeps)) {
      let status: DependencyItem["status"] = "compatible";
      let note = "Librairie standard";

      // Vérifier si c'est une dépendance propriétaire
      const isProprietaryPackage = PROPRIETARY_PATTERNS.packages.some(
        pattern => name.includes(pattern)
      );

      if (isProprietaryPackage) {
        status = "incompatible";
        note = "Package propriétaire - à supprimer";
      } else if (name.includes("supabase")) {
        status = "warning";
        note = "Dépendance backend - à adapter selon votre infrastructure";
      } else if (name === "react" || name === "react-dom") {
        note = "React - compatible avec tout environnement";
      } else if (name.includes("tailwind")) {
        note = "Tailwind CSS - configuration portable";
      } else if (name === "vite") {
        note = "Vite - bundler standard";
      }

      dependencies.push({
        name: `${name}@${version}`,
        type: "Package",
        status,
        note,
      });
    }
  } catch (e) {
    console.error("Error parsing package.json:", e);
  }

  return dependencies;
}

// Analyser les fichiers sources pour les imports propriétaires
function analyzeSourceFile(
  filePath: string,
  content: string
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Vérifier les imports propriétaires
    for (const pattern of PROPRIETARY_PATTERNS.imports) {
      if (line.includes(pattern)) {
        // Déterminer la sévérité
        let severity: AnalysisIssue["severity"] = "critical";
        let description = `Import propriétaire détecté: ${pattern}`;

        if (pattern.includes("use-mobile") || pattern.includes("use-toast")) {
          // Ces hooks peuvent être des versions propriétaires ou standards
          if (line.includes("@lovable") || line.includes("@gptengineer")) {
            severity = "critical";
            description = `Hook propriétaire Lovable/GPT Engineer`;
          } else if (line.includes("@/hooks/")) {
            severity = "warning";
            description = `Hook local - vérifier s'il utilise des APIs propriétaires`;
          }
        }

        issues.push({
          file: filePath,
          line: index + 1,
          pattern,
          severity,
          description,
        });
      }
    }
  });

  return issues;
}

// Calculer le score de portabilité
function calculateScore(
  issues: AnalysisIssue[],
  dependencies: DependencyItem[],
  totalFiles: number
): number {
  let score = 100;

  // Pénalités pour les issues
  const criticalIssues = issues.filter(i => i.severity === "critical").length;
  const warningIssues = issues.filter(i => i.severity === "warning").length;

  score -= criticalIssues * 15; // -15 points par issue critique
  score -= warningIssues * 5;   // -5 points par warning

  // Pénalités pour les dépendances
  const incompatibleDeps = dependencies.filter(d => d.status === "incompatible").length;
  const warningDeps = dependencies.filter(d => d.status === "warning").length;

  score -= incompatibleDeps * 10; // -10 points par dépendance incompatible
  score -= warningDeps * 3;       // -3 points par warning

  // Bonus pour un projet propre
  if (criticalIssues === 0 && incompatibleDeps === 0) {
    score = Math.min(score + 5, 100);
  }

  return Math.max(0, Math.min(100, score));
}

// Générer les recommandations
function generateRecommendations(
  issues: AnalysisIssue[],
  dependencies: DependencyItem[]
): string[] {
  const recommendations: string[] = [];
  const seenPatterns = new Set<string>();

  // Recommandations basées sur les issues
  for (const issue of issues) {
    if (seenPatterns.has(issue.pattern)) continue;
    seenPatterns.add(issue.pattern);

    if (issue.pattern.includes("use-mobile")) {
      recommendations.push("Remplacer use-mobile par une implémentation standard (ex: react-responsive ou custom hook avec window.matchMedia)");
    }
    if (issue.pattern.includes("use-toast")) {
      recommendations.push("Remplacer use-toast par une librairie de notifications standard (ex: react-hot-toast, sonner)");
    }
    if (issue.pattern.includes("@lovable") || issue.pattern.includes("@gptengineer")) {
      recommendations.push("Supprimer les imports @lovable/ et @gptengineer/ et remplacer par des alternatives open-source");
    }
  }

  // Recommandations basées sur les dépendances
  const hasIncompatible = dependencies.some(d => d.status === "incompatible");
  const hasSupabase = dependencies.some(d => d.name.includes("supabase"));

  if (hasIncompatible) {
    recommendations.push("Supprimer les packages propriétaires du package.json");
  }
  if (hasSupabase) {
    recommendations.push("Adapter la configuration Supabase ou migrer vers votre propre backend");
  }

  // Recommandations générales
  recommendations.push("Configurer les alias de chemin (@/) dans votre bundler (Vite/Webpack)");
  recommendations.push("Mettre à jour les variables d'environnement selon votre hébergeur");
  recommendations.push("Tester l'application localement avec npm run dev avant déploiement");

  return [...new Set(recommendations)]; // Supprimer les doublons
}

// Fonction principale d'analyse
export async function analyzeZipFile(
  file: File,
  onProgress: ProgressCallback
): Promise<RealAnalysisResult> {
  const issues: AnalysisIssue[] = [];
  const dependencies: DependencyItem[] = [];
  let totalFiles = 0;
  let analyzedFiles = 0;

  onProgress(5, "Extraction de l'archive...");

  // Charger et extraire le ZIP
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);
  totalFiles = files.length;

  onProgress(15, `Archive extraite (${totalFiles} fichiers)`);

  // Chercher et analyser package.json
  onProgress(20, "Recherche du package.json...");
  
  for (const filePath of files) {
    if (filePath.endsWith("package.json") && !filePath.includes("node_modules")) {
      const content = await zip.files[filePath].async("string");
      const pkgDeps = analyzePackageJson(content);
      dependencies.push(...pkgDeps);
      onProgress(30, `package.json analysé (${pkgDeps.length} dépendances)`);
      break;
    }
  }

  // Vérifier les fichiers de configuration propriétaires
  onProgress(35, "Recherche des fichiers de configuration...");
  
  for (const filePath of files) {
    const fileName = filePath.split("/").pop() || "";
    for (const pattern of PROPRIETARY_PATTERNS.files) {
      if (fileName.includes(pattern)) {
        issues.push({
          file: filePath,
          pattern: fileName,
          severity: "critical",
          description: `Fichier de configuration propriétaire`,
        });
      }
    }
  }

  // Analyser les fichiers sources
  const sourceFiles = files.filter(
    f => (f.endsWith(".tsx") || f.endsWith(".ts") || f.endsWith(".jsx") || f.endsWith(".js")) &&
         !f.includes("node_modules") &&
         !zip.files[f].dir
  );

  const extractedFiles = new Map<string, string>();

  onProgress(40, `Analyse des fichiers sources (0/${sourceFiles.length})...`);

  for (let i = 0; i < sourceFiles.length; i++) {
    const filePath = sourceFiles[i];
    const content = await zip.files[filePath].async("string");
    extractedFiles.set(filePath, content);
    const fileIssues = analyzeSourceFile(filePath, content);
    issues.push(...fileIssues);
    analyzedFiles++;

    // Mise à jour de la progression
    const progress = 40 + Math.floor((i / sourceFiles.length) * 50);
    if (i % 5 === 0 || i === sourceFiles.length - 1) {
      onProgress(progress, `Analyse des fichiers sources (${i + 1}/${sourceFiles.length})...`);
    }
  }

  onProgress(92, "Calcul du score de portabilité...");

  // Calculer le score
  const score = calculateScore(issues, dependencies, totalFiles);

  onProgress(96, "Génération des recommandations...");

  // Générer les recommandations
  const recommendations = generateRecommendations(issues, dependencies);

  // Détecter la plateforme
  const platform = detectPlatform(issues, dependencies);

  onProgress(100, "Analyse terminée !");

  return {
    score,
    platform,
    totalFiles,
    analyzedFiles,
    issues,
    dependencies,
    recommendations,
    extractedFiles,
  };
}
