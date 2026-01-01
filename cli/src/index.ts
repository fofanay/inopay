#!/usr/bin/env node

/**
 * INOPAY LIBERATOR CLI
 * ====================
 * CLI pour libérer les projets propriétaires
 * 
 * Usage:
 *   inopay liberate <path>   - Libère un projet
 *   inopay audit <path>      - Analyse sans modifier
 *   inopay serve             - Lance le dashboard local
 * 
 * © 2024 Inovaq Canada Inc.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';

const VERSION = '1.0.0';

// ============= Banner =============

function showBanner() {
  console.log(chalk.cyan(`
  ╦╔╗╔╔═╗╔═╗╔═╗╦ ╦
  ║║║║║ ║╠═╝╠═╣╚╦╝
  ╩╝╚╝╚═╝╩  ╩ ╩ ╩  LIBERATOR v${VERSION}
  `));
  console.log(chalk.dim('  Libérez votre code. Reprenez le contrôle.\n'));
}

// ============= Patterns de détection =============

const PROPRIETARY_PATTERNS = [
  /@lovable\//i,
  /lovable-tagger/i,
  /@agent\//i,
  /getAIAssistant/i,
  /lovableApi/i,
  /@anthropic-ai\/sdk/i,
];

const PROPRIETARY_FILES = [
  'lovable.config',
  '.lovable',
  'lovable-lock',
  '.agent',
  'agent.config',
  '__lovable__',
];

const TELEMETRY_DOMAINS = [
  'lovable.dev/api',
  'api.lovable.dev',
  'telemetry.lovable',
  'sentry.io',
  'amplitude.com',
];

// ============= Utilitaires =============

function getAllFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    
    // Ignorer node_modules et .git
    if (item === 'node_modules' || item === '.git' || item === 'dist') {
      continue;
    }
    
    if (statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

interface ScanResult {
  proprietaryImports: { file: string; line: number; content: string }[];
  proprietaryFiles: string[];
  telemetryDomains: { file: string; domain: string }[];
  totalFiles: number;
  totalLines: number;
}

function scanProject(projectPath: string): ScanResult {
  const result: ScanResult = {
    proprietaryImports: [],
    proprietaryFiles: [],
    telemetryDomains: [],
    totalFiles: 0,
    totalLines: 0,
  };
  
  const files = getAllFiles(projectPath);
  result.totalFiles = files.length;
  
  for (const file of files) {
    const filename = file.split('/').pop() || '';
    
    // Vérifier les fichiers propriétaires
    if (PROPRIETARY_FILES.some(pf => filename.toLowerCase().includes(pf.toLowerCase()))) {
      result.proprietaryFiles.push(relative(projectPath, file));
    }
    
    // Lire le contenu
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      result.totalLines += lines.length;
      
      // Vérifier les imports
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (const pattern of PROPRIETARY_PATTERNS) {
          if (pattern.test(line)) {
            result.proprietaryImports.push({
              file: relative(projectPath, file),
              line: i + 1,
              content: line.trim().substring(0, 80),
            });
            break;
          }
        }
        
        // Vérifier télémétrie
        for (const domain of TELEMETRY_DOMAINS) {
          if (line.includes(domain)) {
            result.telemetryDomains.push({
              file: relative(projectPath, file),
              domain,
            });
          }
        }
      }
    } catch {
      // Fichier binaire ou non lisible
    }
  }
  
  return result;
}

function calculateScore(result: ScanResult): number {
  const criticalPenalty = result.proprietaryFiles.length * 15;
  const majorPenalty = result.proprietaryImports.length * 5;
  const minorPenalty = result.telemetryDomains.length * 2;
  
  return Math.max(0, 100 - criticalPenalty - majorPenalty - minorPenalty);
}

function getGrade(score: number): string {
  if (score >= 90) return chalk.green('A');
  if (score >= 80) return chalk.green('B');
  if (score >= 70) return chalk.yellow('C');
  if (score >= 60) return chalk.yellow('D');
  return chalk.red('F');
}

// ============= Commandes =============

async function auditCommand(projectPath: string, options: { format: string }) {
  showBanner();
  
  const spinner = ora('Analyse du projet...').start();
  
  try {
    const result = scanProject(projectPath);
    const score = calculateScore(result);
    
    spinner.succeed('Analyse terminée');
    
    if (options.format === 'json') {
      console.log(JSON.stringify({ ...result, score }, null, 2));
      return;
    }
    
    console.log('\n' + chalk.bold('📊 RAPPORT D\'AUDIT'));
    console.log(chalk.dim('─'.repeat(50)));
    
    console.log(`\n${chalk.bold('Score de souveraineté:')} ${score}/100 ${getGrade(score)}`);
    console.log(`${chalk.dim('Fichiers analysés:')} ${result.totalFiles}`);
    console.log(`${chalk.dim('Lignes de code:')} ${result.totalLines.toLocaleString()}`);
    
    if (result.proprietaryFiles.length > 0) {
      console.log(`\n${chalk.red('🚨 Fichiers propriétaires')} (${result.proprietaryFiles.length})`);
      result.proprietaryFiles.forEach(f => console.log(`   ${chalk.dim('-')} ${f}`));
    }
    
    if (result.proprietaryImports.length > 0) {
      console.log(`\n${chalk.yellow('⚠️  Imports propriétaires')} (${result.proprietaryImports.length})`);
      result.proprietaryImports.slice(0, 10).forEach(i => {
        console.log(`   ${chalk.dim('-')} ${i.file}:${i.line}`);
        console.log(`     ${chalk.dim(i.content)}`);
      });
      if (result.proprietaryImports.length > 10) {
        console.log(chalk.dim(`   ... et ${result.proprietaryImports.length - 10} autres`));
      }
    }
    
    if (result.telemetryDomains.length > 0) {
      console.log(`\n${chalk.blue('📡 Télémétrie détectée')} (${result.telemetryDomains.length})`);
      result.telemetryDomains.slice(0, 5).forEach(t => {
        console.log(`   ${chalk.dim('-')} ${t.file}: ${t.domain}`);
      });
    }
    
    console.log('\n' + chalk.dim('─'.repeat(50)));
    
    if (score >= 80) {
      console.log(chalk.green('\n✅ Projet prêt pour une libération rapide'));
    } else if (score >= 60) {
      console.log(chalk.yellow('\n⚠️  Projet nécessite un nettoyage modéré'));
    } else {
      console.log(chalk.red('\n🚨 Projet fortement dépendant - nettoyage complet requis'));
    }
    
    console.log(chalk.dim('\nUtilisez `inopay liberate <path>` pour nettoyer automatiquement\n'));
    
  } catch (error) {
    spinner.fail('Erreur lors de l\'analyse');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

async function liberateCommand(projectPath: string, options: { output: string; dryRun: boolean }) {
  showBanner();
  
  const spinner = ora('Libération en cours...').start();
  
  try {
    // Phase 1: Scan
    spinner.text = 'Phase 1/4: Analyse du projet...';
    const scanResult = scanProject(projectPath);
    
    // Phase 2: Nettoyage
    spinner.text = 'Phase 2/4: Nettoyage des fichiers...';
    
    const outputPath = options.output || `${projectPath}-liberated`;
    
    if (!options.dryRun) {
      if (!existsSync(outputPath)) {
        mkdirSync(outputPath, { recursive: true });
      }
    }
    
    const files = getAllFiles(projectPath);
    let filesProcessed = 0;
    let filesCleaned = 0;
    let filesRemoved = 0;
    
    for (const file of files) {
      const relativePath = relative(projectPath, file);
      const filename = file.split('/').pop() || '';
      
      // Ignorer les fichiers propriétaires
      if (PROPRIETARY_FILES.some(pf => filename.toLowerCase().includes(pf.toLowerCase()))) {
        filesRemoved++;
        continue;
      }
      
      // Lire et nettoyer
      let content = readFileSync(file, 'utf-8');
      let modified = false;
      
      // Supprimer imports propriétaires
      const lines = content.split('\n');
      const cleanedLines = lines.filter(line => {
        for (const pattern of PROPRIETARY_PATTERNS) {
          if (pattern.test(line)) {
            modified = true;
            return false;
          }
        }
        return true;
      });
      
      if (modified) {
        content = cleanedLines.join('\n');
        filesCleaned++;
      }
      
      // Écrire le fichier nettoyé
      if (!options.dryRun) {
        const outputFile = join(outputPath, relativePath);
        const outputDir = outputFile.substring(0, outputFile.lastIndexOf('/'));
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }
        writeFileSync(outputFile, content);
      }
      
      filesProcessed++;
    }
    
    // Phase 3: Génération des fichiers Docker
    spinner.text = 'Phase 3/4: Génération de la configuration Docker...';
    
    if (!options.dryRun) {
      // Dockerfile
      writeFileSync(join(outputPath, 'Dockerfile'), `# INOPAY Liberation Pack
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`);
      
      // docker-compose.yml
      writeFileSync(join(outputPath, 'docker-compose.yml'), `version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
`);
    }
    
    // Phase 4: Génération du rapport
    spinner.text = 'Phase 4/4: Génération du rapport...';
    
    const score = calculateScore(scanResult);
    
    const report = {
      generatedAt: new Date().toISOString(),
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      stats: {
        filesProcessed,
        filesCleaned,
        filesRemoved,
        proprietaryImportsRemoved: scanResult.proprietaryImports.length,
      },
    };
    
    if (!options.dryRun) {
      writeFileSync(join(outputPath, 'liberation-report.json'), JSON.stringify(report, null, 2));
    }
    
    spinner.succeed('Libération terminée!');
    
    console.log('\n' + chalk.bold('📦 RÉSUMÉ DE LIBÉRATION'));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(`${chalk.green('✓')} Fichiers traités: ${filesProcessed}`);
    console.log(`${chalk.green('✓')} Fichiers nettoyés: ${filesCleaned}`);
    console.log(`${chalk.green('✓')} Fichiers propriétaires supprimés: ${filesRemoved}`);
    console.log(`${chalk.green('✓')} Score final: ${score}/100 ${getGrade(score)}`);
    
    if (options.dryRun) {
      console.log(chalk.yellow('\n⚠️  Mode dry-run: aucun fichier n\'a été modifié'));
    } else {
      console.log(chalk.green(`\n✅ Projet libéré dans: ${outputPath}`));
      console.log(chalk.dim('\nPour déployer:'));
      console.log(chalk.cyan(`   cd ${outputPath}`));
      console.log(chalk.cyan('   docker compose up -d'));
    }
    
  } catch (error) {
    spinner.fail('Erreur lors de la libération');
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

async function serveCommand(options: { port: number }) {
  showBanner();
  console.log(chalk.yellow('🚧 Dashboard local en développement...'));
  console.log(chalk.dim(`Le serveur sera disponible sur http://localhost:${options.port}`));
  console.log(chalk.dim('\nEn attendant, utilisez le dashboard web: https://inopay.app/dashboard\n'));
}

// ============= Programme principal =============

const program = new Command();

program
  .name('inopay')
  .description('Inopay Liberator CLI - Libérez vos projets propriétaires')
  .version(VERSION);

program
  .command('audit <path>')
  .description('Analyse un projet sans le modifier')
  .option('-f, --format <format>', 'Format de sortie (text, json)', 'text')
  .action(auditCommand);

program
  .command('liberate <path>')
  .description('Libère un projet (scan, nettoyage, génération)')
  .option('-o, --output <path>', 'Dossier de sortie')
  .option('-d, --dry-run', 'Simulation sans modification', false)
  .action(liberateCommand);

program
  .command('serve')
  .description('Lance le dashboard local')
  .option('-p, --port <port>', 'Port du serveur', '3000')
  .action(serveCommand);

program.parse();
