import JSZip from "jszip";
import { analyzeCostlyServices, CostAnalysisResult } from "./costOptimization";
import {
  PROPRIETARY_IMPORTS,
  PROPRIETARY_FILES,
  SUSPICIOUS_PACKAGES,
  TELEMETRY_DOMAINS,
  PROPRIETARY_ASSET_CDNS,
  shouldRemoveFile,
  needsCleaning as checkNeedsCleaning,
} from "./clientProprietaryPatterns";

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
  costAnalysis?: CostAnalysisResult;
  filesToRemove: string[];
  proprietaryCDNs: string[];
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
  if (allPatterns.includes("cursor")) {
    return "Cursor";
  }
  if (allPatterns.includes("replit")) {
    return "Replit";
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
      const isProprietaryPackage = SUSPICIOUS_PACKAGES.some(
        pattern => name.includes(pattern) || name === pattern
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
    for (const pattern of PROPRIETARY_IMPORTS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(line)) {
        let severity: AnalysisIssue["severity"] = "critical";
        let description = `Import propriétaire détecté: ${pattern.source}`;

        if (pattern.source.includes("use-mobile") || pattern.source.includes("use-toast")) {
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
          pattern: pattern.source,
          severity,
          description,
        });
      }
    }
    
    // Vérifier les domaines de télémétrie
    for (const domain of TELEMETRY_DOMAINS) {
      if (line.includes(domain)) {
        issues.push({
          file: filePath,
          line: index + 1,
          pattern: domain,
          severity: "critical",
          description: `Domaine de télémétrie propriétaire: ${domain}`,
        });
      }
    }
    
    // Vérifier les CDN propriétaires
    for (const cdn of PROPRIETARY_ASSET_CDNS) {
      if (line.includes(cdn)) {
        issues.push({
          file: filePath,
          line: index + 1,
          pattern: cdn,
          severity: "warning",
          description: `Asset CDN propriétaire: ${cdn}`,
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
  totalFiles: number,
  filesToRemove: number
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
  
  // Pénalité pour les fichiers à supprimer
  score -= filesToRemove * 5;

  // Bonus pour un projet propre
  if (criticalIssues === 0 && incompatibleDeps === 0 && filesToRemove === 0) {
    score = Math.min(score + 5, 100);
  }

  return Math.max(0, Math.min(100, score));
}

// Générer les recommandations
function generateRecommendations(
  issues: AnalysisIssue[],
  dependencies: DependencyItem[],
  filesToRemove: string[],
  proprietaryCDNs: string[]
): string[] {
  const recommendations: string[] = [];
  const seenPatterns = new Set<string>();

  // Fichiers à supprimer
  if (filesToRemove.length > 0) {
    recommendations.push(`Supprimer ${filesToRemove.length} fichier(s) de configuration propriétaire`);
  }
  
  // CDN propriétaires
  if (proprietaryCDNs.length > 0) {
    recommendations.push(`Remplacer ${proprietaryCDNs.length} URL(s) de CDN propriétaire par des assets locaux`);
  }

  // Recommandations basées sur les issues
  for (const issue of issues) {
    if (seenPatterns.has(issue.pattern)) continue;
    seenPatterns.add(issue.pattern);

    if (issue.pattern.includes("use-mobile")) {
      recommendations.push("Remplacer use-mobile par une implémentation standard (hook avec window.matchMedia)");
    }
    if (issue.pattern.includes("use-toast")) {
      recommendations.push("Remplacer use-toast par sonner ou react-hot-toast");
    }
    if (issue.pattern.includes("@lovable") || issue.pattern.includes("@gptengineer")) {
      recommendations.push("Supprimer les imports @lovable/ et @gptengineer/");
    }
    if (issue.pattern.includes("@v0") || issue.pattern.includes("v0-")) {
      recommendations.push("Supprimer les imports @v0/ et v0-*");
    }
    if (issue.pattern.includes("@bolt")) {
      recommendations.push("Supprimer les imports @bolt/");
    }
    if (issue.pattern.includes("componentTagger")) {
      recommendations.push("Supprimer le plugin componentTagger de vite.config");
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

  return [...new Set(recommendations)]; // Supprimer les doublons
}

// Fonction principale d'analyse
export async function analyzeZipFile(
  file: File,
  onProgress: ProgressCallback
): Promise<RealAnalysisResult> {
  const issues: AnalysisIssue[] = [];
  const dependencies: DependencyItem[] = [];
  const filesToRemove: string[] = [];
  const proprietaryCDNs: string[] = [];
  let totalFiles = 0;
  let analyzedFiles = 0;

  onProgress(5, "Extraction de l'archive...");

  // Charger et extraire le ZIP
  const zip = await JSZip.loadAsync(file);
  const files = Object.keys(zip.files);
  totalFiles = files.length;

  onProgress(15, `Archive extraite (${totalFiles} fichiers)`);

  // Identifier les fichiers propriétaires à supprimer
  onProgress(18, "Détection des fichiers propriétaires...");
  
  for (const filePath of files) {
    if (shouldRemoveFile(filePath)) {
      filesToRemove.push(filePath);
      issues.push({
        file: filePath,
        pattern: filePath,
        severity: "critical",
        description: "Fichier de configuration propriétaire - sera supprimé",
      });
    }
  }

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
    for (const pattern of PROPRIETARY_FILES) {
      if (fileName === pattern || fileName.includes(pattern)) {
        if (!filesToRemove.includes(filePath)) {
          filesToRemove.push(filePath);
          issues.push({
            file: filePath,
            pattern: fileName,
            severity: "critical",
            description: `Fichier de configuration propriétaire`,
          });
        }
      }
    }
  }

  // Analyser les fichiers sources
  const sourceFiles = files.filter(
    f => (f.endsWith(".tsx") || f.endsWith(".ts") || f.endsWith(".jsx") || f.endsWith(".js") || 
          f.endsWith(".html") || f.endsWith(".json")) &&
         !f.includes("node_modules") &&
         !zip.files[f].dir
  );

  const extractedFiles = new Map<string, string>();

  onProgress(40, `Analyse des fichiers sources (0/${sourceFiles.length})...`);

  for (let i = 0; i < sourceFiles.length; i++) {
    const filePath = sourceFiles[i];
    
    // Skip files to remove
    if (filesToRemove.includes(filePath)) continue;
    
    const content = await zip.files[filePath].async("string");
    extractedFiles.set(filePath, content);
    
    // Analyser le fichier
    const fileIssues = analyzeSourceFile(filePath, content);
    issues.push(...fileIssues);
    analyzedFiles++;
    
    // Vérifier les CDN propriétaires
    for (const cdn of PROPRIETARY_ASSET_CDNS) {
      if (content.includes(cdn) && !proprietaryCDNs.includes(cdn)) {
        proprietaryCDNs.push(cdn);
      }
    }

    // Mise à jour de la progression
    const progress = 40 + Math.floor((i / sourceFiles.length) * 50);
    if (i % 5 === 0 || i === sourceFiles.length - 1) {
      onProgress(progress, `Analyse des fichiers sources (${i + 1}/${sourceFiles.length})...`);
    }
  }

  onProgress(92, "Calcul du score de portabilité...");

  // Calculer le score
  const score = calculateScore(issues, dependencies, totalFiles, filesToRemove.length);

  onProgress(94, "Génération des recommandations...");

  // Générer les recommandations
  const recommendations = generateRecommendations(issues, dependencies, filesToRemove, proprietaryCDNs);

  // Détecter la plateforme
  const platform = detectPlatform(issues, dependencies);

  onProgress(97, "Analyse des coûts...");

  // Analyser les services coûteux
  const pkgJsonForCost = files.find(f => f.endsWith("package.json") && !f.includes("node_modules"));
  const pkgContentForCost = pkgJsonForCost ? await zip.files[pkgJsonForCost].async("string") : undefined;
  const costAnalysis = analyzeCostlyServices(extractedFiles, pkgContentForCost);

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
    costAnalysis,
    filesToRemove,
    proprietaryCDNs,
  };
}

interface GitHubFile {
  path: string;
  content: string;
}

// Fonction d'analyse à partir de fichiers GitHub
export async function analyzeFromGitHub(
  files: GitHubFile[],
  repoName: string,
  onProgress: ProgressCallback
): Promise<RealAnalysisResult> {
  const issues: AnalysisIssue[] = [];
  const dependencies: DependencyItem[] = [];
  const filesToRemove: string[] = [];
  const proprietaryCDNs: string[] = [];
  const totalFiles = files.length;
  let analyzedFiles = 0;

  onProgress(10, `Analyse du dépôt ${repoName}...`);

  // Créer une Map des fichiers extraits
  const extractedFiles = new Map<string, string>();
  
  // Identifier les fichiers propriétaires à supprimer
  onProgress(15, "Détection des fichiers propriétaires...");
  
  for (const file of files) {
    if (shouldRemoveFile(file.path)) {
      filesToRemove.push(file.path);
      issues.push({
        file: file.path,
        pattern: file.path,
        severity: "critical",
        description: "Fichier de configuration propriétaire - sera supprimé",
      });
    } else {
      extractedFiles.set(file.path, file.content);
    }
  }

  // Chercher et analyser package.json
  onProgress(20, "Recherche du package.json...");
  
  const packageJsonFile = files.find(f => 
    f.path === "package.json" || f.path.endsWith("/package.json")
  );
  
  if (packageJsonFile) {
    const pkgDeps = analyzePackageJson(packageJsonFile.content);
    dependencies.push(...pkgDeps);
    onProgress(30, `package.json analysé (${pkgDeps.length} dépendances)`);
  }

  // Vérifier les fichiers de configuration propriétaires
  onProgress(35, "Recherche des fichiers de configuration...");
  
  for (const file of files) {
    const fileName = file.path.split("/").pop() || "";
    for (const pattern of PROPRIETARY_FILES) {
      if (fileName === pattern || fileName.includes(pattern)) {
        if (!filesToRemove.includes(file.path)) {
          filesToRemove.push(file.path);
          issues.push({
            file: file.path,
            pattern: fileName,
            severity: "critical",
            description: `Fichier de configuration propriétaire`,
          });
        }
      }
    }
  }

  // Analyser les fichiers sources
  const sourceFiles = files.filter(
    f => (f.path.endsWith(".tsx") || f.path.endsWith(".ts") || 
         f.path.endsWith(".jsx") || f.path.endsWith(".js") ||
         f.path.endsWith(".html") || f.path.endsWith(".json")) &&
         !filesToRemove.includes(f.path)
  );

  onProgress(40, `Analyse des fichiers sources (0/${sourceFiles.length})...`);

  for (let i = 0; i < sourceFiles.length; i++) {
    const file = sourceFiles[i];
    const fileIssues = analyzeSourceFile(file.path, file.content);
    issues.push(...fileIssues);
    analyzedFiles++;
    
    // Vérifier les CDN propriétaires
    for (const cdn of PROPRIETARY_ASSET_CDNS) {
      if (file.content.includes(cdn) && !proprietaryCDNs.includes(cdn)) {
        proprietaryCDNs.push(cdn);
      }
    }

    // Mise à jour de la progression
    const progress = 40 + Math.floor((i / sourceFiles.length) * 50);
    if (i % 5 === 0 || i === sourceFiles.length - 1) {
      onProgress(progress, `Analyse des fichiers sources (${i + 1}/${sourceFiles.length})...`);
    }
  }

  onProgress(92, "Calcul du score de portabilité...");

  // Calculer le score
  const score = calculateScore(issues, dependencies, totalFiles, filesToRemove.length);

  onProgress(94, "Génération des recommandations...");

  // Générer les recommandations
  const recommendations = generateRecommendations(issues, dependencies, filesToRemove, proprietaryCDNs);

  // Détecter la plateforme
  const platform = detectPlatform(issues, dependencies);

  onProgress(97, "Analyse des coûts...");

  // Analyser les services coûteux
  const pkgForCost = files.find(f => f.path === "package.json" || f.path.endsWith("/package.json"));
  const costAnalysis = analyzeCostlyServices(extractedFiles, pkgForCost?.content);

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
    costAnalysis,
    filesToRemove,
    proprietaryCDNs,
  };
}
