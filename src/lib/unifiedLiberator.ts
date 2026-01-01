/**
 * UNIFIED LIBERATOR SERVICE
 * =========================
 * Orchestrateur central pour la libération de projets
 * Unifie tous les modules: Scanner, Cleaner, Refactor, Rebuilder
 * 
 * Point d'entrée unique pour LiberationPackHub
 */

import { LovablePatternScanner, type ScanResult, type ScanIssue } from './lovablePatternScanner';
import { LovableCleanerEngine, type CleaningReport, type CleaningOptions } from './lovableCleanerEngine';
import { ASTRefactor, type RefactorResult } from './astRefactor';
import { ProjectRebuilder, type ProjectConfig, type RebuiltProject } from './projectRebuilder';

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface LiberationOptions {
  projectName: string;
  
  // Cleaning options
  removeProprietaryImports?: boolean;
  removeProprietaryFiles?: boolean;
  removeTelemetry?: boolean;
  cleanComments?: boolean;
  
  // Rebuild options
  includeBackend?: boolean;
  includeDatabase?: boolean;
  includeAuth?: boolean;
  includeStorage?: boolean;
  
  // AI options
  aiProvider?: 'ollama' | 'lmstudio' | 'openwebui' | 'openai-compatible' | 'none';
  aiModel?: string;
  
  // Deployment options
  domain?: string;
  sslEmail?: string;
  deploymentTarget?: 'vps' | 'coolify' | 'docker-swarm' | 'kubernetes';
}

export interface LiberationResult {
  success: boolean;
  
  // Phase 1: Scan
  scanResult: ScanResult;
  
  // Phase 2: Clean
  cleaningReport: CleaningReport;
  cleanedFiles: Map<string, string>;
  
  // Phase 3: Refactor
  refactorResults: Map<string, RefactorResult>;
  
  // Phase 4: Rebuild
  rebuiltProject: RebuiltProject;
  
  // Stats
  stats: LiberationStats;
  
  // Errors if any
  errors: string[];
  warnings: string[];
}

export interface LiberationStats {
  totalFilesProcessed: number;
  filesRemoved: number;
  filesCleaned: number;
  filesRefactored: number;
  filesGenerated: number;
  patternsDetected: number;
  patternsFixed: number;
  sovereigntyScoreBefore: number;
  sovereigntyScoreAfter: number;
  processingTimeMs: number;
  timestamp: string;
}

export interface LiberationProgress {
  phase: 'scan' | 'clean' | 'refactor' | 'rebuild' | 'package' | 'complete';
  progress: number; // 0-100
  message: string;
  currentFile?: string;
}

export type ProgressCallback = (progress: LiberationProgress) => void;

// ═══════════════════════════════════════════════════════════════
// UNIFIED LIBERATOR CLASS
// ═══════════════════════════════════════════════════════════════

export class UnifiedLiberator {
  private scanner: LovablePatternScanner;
  private cleaner: LovableCleanerEngine;
  private refactor: ASTRefactor;
  private options: LiberationOptions;
  private onProgress?: ProgressCallback;

  constructor(options: LiberationOptions, onProgress?: ProgressCallback) {
    this.options = {
      removeProprietaryImports: true,
      removeProprietaryFiles: true,
      removeTelemetry: true,
      cleanComments: true,
      includeBackend: true,
      includeDatabase: true,
      includeAuth: true,
      includeStorage: false,
      aiProvider: 'ollama',
      deploymentTarget: 'vps',
      ...options
    };
    
    this.scanner = new LovablePatternScanner();
    this.cleaner = new LovableCleanerEngine({
      removeImports: this.options.removeProprietaryImports ?? true,
      replacePatterns: true,
      generatePolyfills: true,
      fixDependencies: true,
      preserveComments: !this.options.cleanComments,
      dryRun: false
    });
    this.refactor = new ASTRefactor();
    this.onProgress = onProgress;
  }

  /**
   * Main liberation entry point
   * Orchestrates all phases in sequence
   */
  async liberate(files: Record<string, string>): Promise<LiberationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // ═══════════════════════════════════════════════════════════
      // PHASE 1: SCAN
      // ═══════════════════════════════════════════════════════════
      this.reportProgress('scan', 0, 'Démarrage de l\'analyse...');
      
      const scanResult = await this.runScanPhase(files);
      const sovereigntyScoreBefore = scanResult.score;
      
      this.reportProgress('scan', 100, `Analyse terminée: ${scanResult.issues.length} patterns détectés`);

      // ═══════════════════════════════════════════════════════════
      // PHASE 2: CLEAN
      // ═══════════════════════════════════════════════════════════
      this.reportProgress('clean', 0, 'Nettoyage des fichiers...');
      
      const { cleaningReport, cleanedFiles } = await this.runCleanPhase(files, scanResult);
      
      this.reportProgress('clean', 100, `Nettoyage terminé: ${cleaningReport.filesModified} fichiers modifiés`);

      // ═══════════════════════════════════════════════════════════
      // PHASE 3: REFACTOR
      // ═══════════════════════════════════════════════════════════
      this.reportProgress('refactor', 0, 'Refactoring AST...');
      
      const refactorResults = await this.runRefactorPhase(cleanedFiles);
      
      // Apply refactored content
      for (const [path, result] of refactorResults) {
        if (result.stats.appliedPatterns > 0) {
          cleanedFiles.set(path, result.refactoredCode);
        }
      }
      
      this.reportProgress('refactor', 100, `Refactoring terminé: ${refactorResults.size} fichiers traités`);

      // ═══════════════════════════════════════════════════════════
      // PHASE 4: REBUILD
      // ═══════════════════════════════════════════════════════════
      this.reportProgress('rebuild', 0, 'Reconstruction de l\'architecture souveraine...');
      
      const rebuiltProject = await this.runRebuildPhase(cleanedFiles);
      
      this.reportProgress('rebuild', 100, `Reconstruction terminée: ${rebuiltProject.stats.totalFiles} fichiers générés`);

      // ═══════════════════════════════════════════════════════════
      // PHASE 5: PACKAGE (included in rebuild)
      // ═══════════════════════════════════════════════════════════
      this.reportProgress('package', 0, 'Packaging du liberation pack...');
      
      // Calculate final sovereignty score
      const finalFiles: Record<string, string> = {};
      for (const [path, content] of rebuiltProject.files) {
        finalFiles[path] = content;
      }
      const finalScan = this.scanner.scanProject(finalFiles);
      const sovereigntyScoreAfter = finalScan.score;
      
      this.reportProgress('package', 100, 'Pack de libération prêt !');

      // ═══════════════════════════════════════════════════════════
      // COMPLETE
      // ═══════════════════════════════════════════════════════════
      this.reportProgress('complete', 100, 'Libération terminée avec succès !');

      const processingTimeMs = Date.now() - startTime;
      
      return {
        success: true,
        scanResult,
        cleaningReport,
        cleanedFiles,
        refactorResults,
        rebuiltProject,
        stats: {
          totalFilesProcessed: Object.keys(files).length,
          filesRemoved: cleaningReport.filesRemoved,
          filesCleaned: cleaningReport.filesModified,
          filesRefactored: Array.from(refactorResults.values()).filter(r => r.stats.appliedPatterns > 0).length,
          filesGenerated: rebuiltProject.stats.totalFiles,
          patternsDetected: scanResult.issues.length,
          patternsFixed: cleaningReport.summary.patternsReplaced,
          sovereigntyScoreBefore,
          sovereigntyScoreAfter,
          processingTimeMs,
          timestamp: new Date().toISOString()
        },
        errors,
        warnings
      };
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        scanResult: { 
          totalFiles: 0,
          filesScanned: 0, 
          filesWithIssues: 0,
          issues: [], 
          summary: { critical: 0, major: 0, minor: 0 },
          score: 0, 
          grade: 'F' 
        },
        cleaningReport: {
          totalFiles: 0,
          filesModified: 0,
          filesRemoved: 0,
          filesUnchanged: 0,
          totalChanges: 0,
          totalRewrites: 0,
          results: new Map(),
          cleanedFiles: {},
          packageJsonPatches: [],
          summary: {
            importsRemoved: 0,
            patternsReplaced: 0,
            dependenciesFixed: 0,
            polyfillsGenerated: 0,
            estimatedTimeSaved: 0
          }
        },
        cleanedFiles: new Map(),
        refactorResults: new Map(),
        rebuiltProject: {
          files: new Map(),
          structure: { backend: [], frontend: [], docker: [], scripts: [], database: [], config: [] },
          config: {} as any,
          readme: '',
          stats: { totalFiles: 0, backendFiles: 0, frontendFiles: 0, dockerFiles: 0, scriptFiles: 0, generatedBytes: 0, timestamp: '' }
        },
        stats: {
          totalFilesProcessed: 0,
          filesRemoved: 0,
          filesCleaned: 0,
          filesRefactored: 0,
          filesGenerated: 0,
          patternsDetected: 0,
          patternsFixed: 0,
          sovereigntyScoreBefore: 0,
          sovereigntyScoreAfter: 0,
          processingTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        },
        errors,
        warnings
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE RUNNERS
  // ═══════════════════════════════════════════════════════════════

  private async runScanPhase(files: Record<string, string>): Promise<ScanResult> {
    return this.scanner.scanProject(files);
  }

  private async runCleanPhase(
    files: Record<string, string>, 
    scanResult: ScanResult
  ): Promise<{ cleaningReport: CleaningReport; cleanedFiles: Map<string, string> }> {
    const cleaningReport = this.cleaner.cleanProject(files, scanResult);
    
    const cleanedFiles = new Map<string, string>();
    for (const [path, result] of cleaningReport.results) {
      if (!result.wasRemoved) {
        cleanedFiles.set(path, result.cleanedContent);
      }
    }
    
    return { cleaningReport, cleanedFiles };
  }

  private async runRefactorPhase(
    cleanedFiles: Map<string, string>
  ): Promise<Map<string, RefactorResult>> {
    const results = new Map<string, RefactorResult>();
    
    for (const [path, content] of cleanedFiles) {
      // Only refactor JS/TS files
      if (this.isCodeFile(path)) {
        try {
          const result = this.refactor.refactor(content, path);
          results.set(path, result);
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
    
    return results;
  }

  private async runRebuildPhase(cleanedFiles: Map<string, string>): Promise<RebuiltProject> {
    const config: ProjectConfig = {
      name: this.options.projectName,
      version: '1.0.0',
      description: `Liberation Pack for ${this.options.projectName}`,
      hasBackend: this.options.includeBackend ?? true,
      hasDatabase: this.options.includeDatabase ?? true,
      hasAuth: this.options.includeAuth ?? true,
      hasStorage: this.options.includeStorage ?? false,
      hasRealtime: false,
      aiProvider: this.options.aiProvider,
      domain: this.options.domain,
      sslEmail: this.options.sslEmail,
      deploymentTarget: this.options.deploymentTarget,
      envVars: this.extractEnvVars(cleanedFiles),
      sourceFiles: cleanedFiles
    };
    
    const rebuilder = new ProjectRebuilder(config);
    return rebuilder.rebuild();
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private reportProgress(
    phase: LiberationProgress['phase'], 
    progress: number, 
    message: string,
    currentFile?: string
  ): void {
    if (this.onProgress) {
      this.onProgress({ phase, progress, message, currentFile });
    }
  }

  private isCodeFile(path: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    return codeExtensions.some(ext => path.endsWith(ext));
  }

  private extractEnvVars(files: Map<string, string>): string[] {
    const envVars = new Set<string>();
    
    for (const [, content] of files) {
      // Match import.meta.env.VITE_*
      const viteMatches = content.matchAll(/import\.meta\.env\.(VITE_[A-Z_]+)/g);
      for (const match of viteMatches) {
        envVars.add(match[1]);
      }
      
      // Match process.env.*
      const processMatches = content.matchAll(/process\.env\.([A-Z_]+)/g);
      for (const match of processMatches) {
        envVars.add(match[1]);
      }
    }
    
    return Array.from(envVars);
  }

  // ═══════════════════════════════════════════════════════════════
  // STATIC UTILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Quick scan without full liberation
   */
  static quickScan(files: Record<string, string>): ScanResult {
    const scanner = new LovablePatternScanner();
    return scanner.scanProject(files);
  }

  /**
   * Quick audit with grade
   */
  static audit(files: Record<string, string>): {
    score: number;
    grade: string;
    issues: ScanIssue[];
    summary: string;
  } {
    const result = UnifiedLiberator.quickScan(files);
    return {
      score: result.score,
      grade: result.grade,
      issues: result.issues,
      summary: `${result.filesScanned} fichiers analysés, ${result.issues.length} patterns détectés, score: ${result.score}/100 (${result.grade})`
    };
  }

  /**
   * Generate liberation report as JSON
   */
  static generateReport(result: LiberationResult): string {
    return JSON.stringify({
      success: result.success,
      timestamp: result.stats.timestamp,
      projectName: result.rebuiltProject.config.name,
      scan: {
        filesScanned: result.scanResult.filesScanned,
        issuesFound: result.scanResult.issues.length,
        score: result.scanResult.score,
        grade: result.scanResult.grade
      },
      cleaning: {
        filesModified: result.cleaningReport.filesModified,
        filesRemoved: result.cleaningReport.filesRemoved,
        importsRemoved: result.cleaningReport.summary.importsRemoved,
        patternsReplaced: result.cleaningReport.summary.patternsReplaced
      },
      refactoring: {
        filesRefactored: result.stats.filesRefactored,
        totalChanges: Array.from(result.refactorResults.values())
          .reduce((sum, r) => sum + r.stats.appliedPatterns, 0)
      },
      rebuild: {
        totalFiles: result.rebuiltProject.stats.totalFiles,
        backendFiles: result.rebuiltProject.stats.backendFiles,
        frontendFiles: result.rebuiltProject.stats.frontendFiles,
        dockerFiles: result.rebuiltProject.stats.dockerFiles
      },
      stats: result.stats,
      errors: result.errors,
      warnings: result.warnings
    }, null, 2);
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════

/**
 * Quick liberation function
 */
export async function liberateProject(
  files: Record<string, string>,
  projectName: string,
  options?: Partial<LiberationOptions>,
  onProgress?: ProgressCallback
): Promise<LiberationResult> {
  const liberator = new UnifiedLiberator(
    { projectName, ...options },
    onProgress
  );
  return liberator.liberate(files);
}

/**
 * Quick scan function
 */
export function scanProject(files: Record<string, string>): ScanResult {
  return UnifiedLiberator.quickScan(files);
}

/**
 * Quick audit function
 */
export function auditProject(files: Record<string, string>) {
  return UnifiedLiberator.audit(files);
}

export default UnifiedLiberator;
