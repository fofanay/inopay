/**
 * LIBERATOR API ROUTES
 * ====================
 * POST /liberate - Lance une libération complète
 * GET /audit/:id - Récupère le rapport d'audit
 * GET /download/:id - Télécharge l'archive libérée
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

// Types
interface LiberationJob {
  id: string;
  status: 'pending' | 'scanning' | 'auditing' | 'cleaning' | 'rebuilding' | 'completed' | 'failed';
  progress: number;
  projectName: string;
  sourceType: 'zip' | 'github' | 'url';
  sourceUrl?: string;
  createdAt: string;
  completedAt?: string;
  auditReport?: AuditReport;
  resultUrl?: string;
  error?: string;
}

interface AuditReport {
  score: number;
  grade: string;
  totalFiles: number;
  totalLines: number;
  issues: {
    critical: number;
    major: number;
    minor: number;
  };
  details: AuditIssue[];
  proprietaryFiles: string[];
}

interface AuditIssue {
  file: string;
  line: number;
  pattern: string;
  severity: 'critical' | 'major' | 'minor';
  suggestion: string;
}

interface CleanResult {
  filesProcessed: number;
  filesCleaned: number;
  filesRemoved: number;
  linesRemoved: number;
}

// ═══════════════════════════════════════════════════════════════
// PATTERNS DE DÉTECTION LOVABLE
// ═══════════════════════════════════════════════════════════════

const LOVABLE_PATTERNS = [
  // Critical
  { pattern: /lovable\.generate\s*\(/g, name: 'lovable.generate()', severity: 'critical' as const, suggestion: 'Remplacer par sovereignAI.generateCompletion()' },
  { pattern: /lovableApi\s*[.(]/g, name: 'lovableApi', severity: 'critical' as const, suggestion: 'Utiliser API REST standard' },
  { pattern: /getAIAssistant\s*\(/g, name: 'getAIAssistant()', severity: 'critical' as const, suggestion: 'Remplacer par sovereignAI.createAssistant()' },
  { pattern: /runAssistant\s*\(/g, name: 'runAssistant()', severity: 'critical' as const, suggestion: 'Remplacer par sovereignAI.run()' },
  { pattern: /@agent\/[a-zA-Z-]+/g, name: '@agent/* packages', severity: 'critical' as const, suggestion: 'Supprimer packages agent' },
  
  // Major
  { pattern: /@lovable\/[a-zA-Z-]+/g, name: '@lovable/* packages', severity: 'major' as const, suggestion: 'Remplacer par npm standard' },
  { pattern: /lovable-tagger/g, name: 'lovable-tagger', severity: 'major' as const, suggestion: 'Supprimer' },
  { pattern: /from\s+['"]@\/integrations\/supabase/g, name: 'Supabase auto-gen', severity: 'major' as const, suggestion: 'Client Supabase standard' },
  { pattern: /EventSchema\s*[.(]/g, name: 'EventSchema', severity: 'major' as const, suggestion: 'Utiliser Zod' },
  { pattern: /Pattern\.[A-Z]/g, name: 'Pattern.*', severity: 'major' as const, suggestion: 'Implémenter localement' },
  
  // Minor
  { pattern: /data-lov-id/g, name: 'data-lov-id', severity: 'minor' as const, suggestion: 'Supprimer attribut' },
  { pattern: /data-lovable-[a-z-]+/g, name: 'data-lovable-*', severity: 'minor' as const, suggestion: 'Supprimer attributs' },
  { pattern: /\/\/\s*@lovable-/g, name: '@lovable- annotations', severity: 'minor' as const, suggestion: 'Supprimer commentaires' },
];

const PROPRIETARY_FILES = [
  'lovable.config.ts', 'lovable.config.js', 'lovable.config.json',
  '.lovable', '.lovablerc', 'lovable-lock.json',
  '.agent', 'agent.config.ts', '__lovable__',
];

// ═══════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════

// In-memory store for demo (use Redis/DB in production)
const jobs = new Map<string, LiberationJob>();
const archives = new Map<string, Buffer>();

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════════════════════════
// LIBÉRATION ENGINE
// ═══════════════════════════════════════════════════════════════

async function scanFiles(files: Map<string, string>): Promise<AuditReport> {
  const issues: AuditIssue[] = [];
  const proprietaryFiles: string[] = [];
  let totalFiles = 0;
  let totalLines = 0;

  for (const [path, content] of files) {
    totalFiles++;
    const filename = path.split('/').pop() || '';
    
    // Check proprietary files
    if (PROPRIETARY_FILES.some(pf => filename.toLowerCase() === pf.toLowerCase())) {
      proprietaryFiles.push(path);
      continue;
    }

    const lines = content.split('\n');
    totalLines += lines.length;

    // Scan for patterns
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      for (const patternDef of LOVABLE_PATTERNS) {
        patternDef.pattern.lastIndex = 0;
        if (patternDef.pattern.test(line)) {
          issues.push({
            file: path,
            line: lineNum + 1,
            pattern: patternDef.name,
            severity: patternDef.severity,
            suggestion: patternDef.suggestion,
          });
        }
      }
    }
  }

  // Calculate score
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 10;
    else if (issue.severity === 'major') score -= 5;
    else score -= 1;
  }
  score -= proprietaryFiles.length * 15;
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return {
    score,
    grade,
    totalFiles,
    totalLines,
    issues: {
      critical: issues.filter(i => i.severity === 'critical').length,
      major: issues.filter(i => i.severity === 'major').length,
      minor: issues.filter(i => i.severity === 'minor').length,
    },
    details: issues,
    proprietaryFiles,
  };
}

function cleanContent(content: string, filename: string): { content: string; modified: boolean; linesRemoved: number } {
  let modified = false;
  const originalLineCount = content.split('\n').length;

  // Remove proprietary imports
  const importPatterns = [
    /^import\s+.*from\s+['"]@lovable\/.*['"];?\s*$/gm,
    /^import\s+.*from\s+['"]@agent\/.*['"];?\s*$/gm,
    /^import\s+.*from\s+['"]lovable-tagger['"];?\s*$/gm,
    /^const\s+\{.*\}\s*=\s*require\(['"]@lovable\/.*['"]\);?\s*$/gm,
  ];

  for (const pattern of importPatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, '// [REMOVED] Proprietary import');
      modified = true;
    }
  }

  // Pattern replacements
  const replacements = [
    { from: /getAIAssistant\s*\(/g, to: 'sovereignAI.createAssistant(' },
    { from: /runAssistant\s*\(/g, to: 'sovereignAI.run(' },
    { from: /lovable\.generate\s*\(/g, to: 'sovereignAI.generateCompletion(' },
    { from: /lovableApi\./g, to: 'api.' },
    { from: /Pattern\.Template/g, to: 'createTemplateEngine()' },
    { from: /Pattern\.State/g, to: 'createStateManager()' },
    { from: /EventSchema\./g, to: 'z.' },
  ];

  for (const { from, to } of replacements) {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  }

  // Remove data attributes
  content = content.replace(/\s+data-lov-id="[^"]*"/g, '');
  content = content.replace(/\s+data-lovable-[a-z-]+="[^"]*"/g, '');

  // Clean excessive newlines
  content = content.replace(/\n{4,}/g, '\n\n\n');

  const newLineCount = content.split('\n').length;
  
  return {
    content,
    modified,
    linesRemoved: Math.max(0, originalLineCount - newLineCount),
  };
}

async function cleanFiles(files: Map<string, string>): Promise<{ files: Map<string, string>; result: CleanResult }> {
  const cleanedFiles = new Map<string, string>();
  let filesProcessed = 0;
  let filesCleaned = 0;
  let filesRemoved = 0;
  let linesRemoved = 0;

  for (const [path, content] of files) {
    const filename = path.split('/').pop() || '';
    
    // Skip proprietary files
    if (PROPRIETARY_FILES.some(pf => filename.toLowerCase() === pf.toLowerCase())) {
      filesRemoved++;
      continue;
    }

    // Clean text files
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const textExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'md', 'yaml', 'yml'];
    
    if (textExtensions.includes(ext)) {
      const { content: cleaned, modified, linesRemoved: removed } = cleanContent(content, filename);
      cleanedFiles.set(path, cleaned);
      if (modified) filesCleaned++;
      linesRemoved += removed;
    } else {
      cleanedFiles.set(path, content);
    }
    
    filesProcessed++;
  }

  return {
    files: cleanedFiles,
    result: { filesProcessed, filesCleaned, filesRemoved, linesRemoved }
  };
}

function generateSovereignFiles(projectName: string): Map<string, string> {
  const files = new Map<string, string>();

  // Dockerfile
  files.set('Dockerfile', `# ${projectName} - Sovereign Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`);

  // docker-compose.yml
  files.set('docker-compose.yml', `version: '3.8'
services:
  app:
    build: .
    container_name: ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
    restart: unless-stopped
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
`);

  // Deploy script
  files.set('deploy.sh', `#!/bin/bash
set -e
echo "🚀 Deploying ${projectName}..."
docker compose up -d --build
echo "✅ Deployed!"
`);

  // inopay.config.json
  files.set('inopay.config.json', JSON.stringify({
    version: '1.0.0',
    name: projectName,
    liberatedAt: new Date().toISOString(),
    sovereign: true,
  }, null, 2));

  return files;
}

async function processLiberation(jobId: string, zipBuffer: Buffer, projectName: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Phase 1: Extract
    job.status = 'scanning';
    job.progress = 10;
    jobs.set(jobId, job);

    const zip = await JSZip.loadAsync(zipBuffer);
    const files = new Map<string, string>();
    
    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async('string');
        files.set(path, content);
      }
    }

    // Phase 2: Audit
    job.status = 'auditing';
    job.progress = 30;
    jobs.set(jobId, job);
    
    const auditReport = await scanFiles(files);
    job.auditReport = auditReport;

    // Phase 3: Clean
    job.status = 'cleaning';
    job.progress = 50;
    jobs.set(jobId, job);
    
    const { files: cleanedFiles } = await cleanFiles(files);

    // Phase 4: Rebuild
    job.status = 'rebuilding';
    job.progress = 70;
    jobs.set(jobId, job);
    
    const sovereignFiles = generateSovereignFiles(projectName);
    for (const [path, content] of sovereignFiles) {
      cleanedFiles.set(path, content);
    }

    // Phase 5: Create archive
    job.progress = 90;
    const outputZip = new JSZip();
    for (const [path, content] of cleanedFiles) {
      outputZip.file(`${projectName}-liberated/${path}`, content);
    }
    
    const outputBuffer = await outputZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    archives.set(jobId, outputBuffer);

    // Complete
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.resultUrl = `/api/liberate/download/${jobId}`;
    jobs.set(jobId, job);

    // Store in Supabase
    if (supabaseUrl && supabaseKey) {
      await supabase.from('liberation_jobs').upsert({
        id: jobId,
        user_id: '00000000-0000-0000-0000-000000000000', // Would come from auth
        project_name: projectName,
        source_type: 'zip',
        status: 'completed',
        progress: 100,
        audit_score: auditReport.score,
        audit_report: auditReport,
        files_count: files.size,
        files_cleaned: auditReport.issues.critical + auditReport.issues.major,
        completed_at: job.completedAt,
      });
    }

  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    jobs.set(jobId, job);
    console.error('Liberation failed:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

export const liberateRouter = Router();

/**
 * POST /liberate
 * Lance une libération complète
 */
liberateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { file, projectName, sourceType, sourceUrl } = req.body;

    if (!file || !projectName) {
      return res.status(400).json({ error: 'file and projectName are required' });
    }

    const jobId = uuidv4();
    const job: LiberationJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      projectName,
      sourceType: sourceType || 'zip',
      sourceUrl,
      createdAt: new Date().toISOString(),
    };
    
    jobs.set(jobId, job);

    // Decode base64 file and start processing
    const zipBuffer = Buffer.from(file, 'base64');
    
    // Process async
    processLiberation(jobId, zipBuffer, projectName);

    res.json({
      id: jobId,
      status: 'pending',
      message: 'Liberation started',
      statusUrl: `/api/liberate/audit/${jobId}`,
      downloadUrl: `/api/liberate/download/${jobId}`,
    });

  } catch (error) {
    console.error('Liberate error:', error);
    res.status(500).json({ error: 'Failed to start liberation' });
  }
});

/**
 * GET /audit/:id
 * Récupère le statut et rapport d'audit
 */
liberateRouter.get('/audit/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = jobs.get(id);

    if (!job) {
      // Try Supabase
      if (supabaseUrl && supabaseKey) {
        const { data, error } = await supabase
          .from('liberation_jobs')
          .select('*')
          .eq('id', id)
          .single();
        
        if (data && !error) {
          return res.json({
            id: data.id,
            status: data.status,
            progress: data.progress,
            projectName: data.project_name,
            auditReport: data.audit_report,
            completedAt: data.completed_at,
          });
        }
      }
      
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      projectName: job.projectName,
      auditReport: job.auditReport,
      resultUrl: job.resultUrl,
      completedAt: job.completedAt,
      error: job.error,
    });

  } catch (error) {
    console.error('Audit fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit' });
  }
});

/**
 * GET /download/:id
 * Télécharge l'archive libérée
 */
liberateRouter.get('/download/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = jobs.get(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Liberation not completed',
        status: job.status,
        progress: job.progress 
      });
    }

    const archive = archives.get(id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${job.projectName}-liberated.zip"`);
    res.send(archive);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download archive' });
  }
});

/**
 * GET /jobs
 * Liste tous les jobs (pour debug)
 */
liberateRouter.get('/jobs', (req: Request, res: Response) => {
  const allJobs = Array.from(jobs.values()).map(j => ({
    id: j.id,
    status: j.status,
    progress: j.progress,
    projectName: j.projectName,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
  }));
  
  res.json(allJobs);
});
