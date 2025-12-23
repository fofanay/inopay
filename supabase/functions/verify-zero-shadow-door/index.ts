import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TELEMETRY_DOMAINS,
  SUSPICIOUS_PACKAGES,
  HIDDEN_PLUGIN_PATTERNS,
} from "../_shared/proprietary-patterns.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CDN proprietary patterns
const PROPRIETARY_CDNS = [
  'cdn.lovable.app',
  'cdn.gptengineer.app',
  'assets.lovable',
  'static.lovable',
];

interface SecurityFinding {
  type: 'critical' | 'warning' | 'info';
  category: 'obfuscation' | 'telemetry' | 'ghost_hook' | 'cdn' | 'eval';
  filePath: string;
  line?: number;
  description: string;
  originalCode?: string;
  recommendation: string;
  quarantined: boolean;
}

interface AuditResult {
  success: boolean;
  isSovereign: boolean;
  totalFilesScanned: number;
  findings: SecurityFinding[];
  quarantinedFiles: string[];
  cleanedFiles: { path: string; originalContent: string; cleanedContent: string }[];
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    obfuscationFound: number;
    telemetryFound: number;
    ghostHooksFound: number;
    evalRemoved: number;
  };
  certificationStatus: 'sovereign' | 'requires_review' | 'compromised';
  certificationMessage: string;
}

// Detect Base64 encoded strings (suspicious if > 100 chars)
function detectBase64Obfuscation(content: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const base64Pattern = /['"`]([A-Za-z0-9+/=]{100,})['"`]/g;
  let match;
  
  while ((match = base64Pattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Try to decode to check if it's suspicious
    try {
      const decoded = atob(match[1]);
      // Check if decoded content contains suspicious patterns
      const hasSuspiciousContent = TELEMETRY_DOMAINS.some(domain => 
        decoded.toLowerCase().includes(domain)
      ) || decoded.includes('eval(') || decoded.includes('Function(');
      
      if (hasSuspiciousContent) {
        findings.push({
          type: 'critical',
          category: 'obfuscation',
          filePath,
          line: lineNumber,
          description: `Chaîne Base64 suspecte détectée (${match[1].length} caractères) contenant du code potentiellement malveillant`,
          originalCode: match[0].substring(0, 100) + '...',
          recommendation: 'Supprimer cette chaîne encodée ou la remplacer par du code transparent',
          quarantined: true,
        });
      }
    } catch {
      // Not valid Base64, might still be suspicious if very long
      if (match[1].length > 500) {
        findings.push({
          type: 'warning',
          category: 'obfuscation',
          filePath,
          line: lineNumber,
          description: `Longue chaîne non-décodable détectée (${match[1].length} caractères)`,
          originalCode: match[0].substring(0, 100) + '...',
          recommendation: 'Vérifier manuellement le contenu de cette chaîne',
          quarantined: false,
        });
      }
    }
  }
  
  return findings;
}

// Detect hex-encoded strings
function detectHexObfuscation(content: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const hexPattern = /((?:\\x[0-9a-fA-F]{2}){10,}|0x[0-9a-fA-F]{20,})/g;
  let match;
  
  while ((match = hexPattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    findings.push({
      type: 'warning',
      category: 'obfuscation',
      filePath,
      line: lineNumber,
      description: `Chaîne hexadécimale suspecte détectée (${match[1].length} caractères)`,
      originalCode: match[0].substring(0, 80) + '...',
      recommendation: 'Décoder et vérifier le contenu de cette chaîne',
      quarantined: false,
    });
  }
  
  return findings;
}

// Detect eval() and new Function() usage
function detectEvalUsage(content: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  
  // Detect eval()
  const evalPattern = /\beval\s*\(/g;
  let match;
  
  while ((match = evalPattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    const lineContent = content.split('\n')[lineNumber - 1]?.trim() || '';
    
    findings.push({
      type: 'critical',
      category: 'eval',
      filePath,
      line: lineNumber,
      description: 'Utilisation de eval() détectée - risque d\'injection de code',
      originalCode: lineContent.substring(0, 100),
      recommendation: 'Supprimer eval() et utiliser des alternatives sécurisées',
      quarantined: true,
    });
  }
  
  // Detect new Function()
  const newFunctionPattern = /new\s+Function\s*\(/g;
  
  while ((match = newFunctionPattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    const lineContent = content.split('\n')[lineNumber - 1]?.trim() || '';
    
    findings.push({
      type: 'critical',
      category: 'eval',
      filePath,
      line: lineNumber,
      description: 'Utilisation de new Function() détectée - risque d\'injection de code',
      originalCode: lineContent.substring(0, 100),
      recommendation: 'Supprimer new Function() et utiliser des alternatives sécurisées',
      quarantined: true,
    });
  }
  
  return findings;
}

// Detect telemetry endpoints and tracker URLs (using shared TELEMETRY_DOMAINS)
function detectTelemetryEndpoints(content: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  
  for (const domain of TELEMETRY_DOMAINS) {
    const domainPattern = new RegExp(`['"\`][^'"\`]*${domain.replace(/\./g, '\\.')}[^'"\`]*['"\`]`, 'gi');
    let match;
    
    while ((match = domainPattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      findings.push({
        type: 'critical',
        category: 'telemetry',
        filePath,
        line: lineNumber,
        description: `Endpoint de télémétrie détecté: ${domain}`,
        originalCode: match[0].substring(0, 100),
        recommendation: 'Supprimer cet appel de télémétrie pour garantir la souveraineté',
        quarantined: true,
      });
    }
  }
  
  // Detect fetch/axios calls to suspicious domains
  const fetchPattern = /(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match;
  
  while ((match = fetchPattern.exec(content)) !== null) {
    const url = match[1];
    if (TELEMETRY_DOMAINS.some(domain => url.includes(domain))) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      findings.push({
        type: 'critical',
        category: 'telemetry',
        filePath,
        line: lineNumber,
        description: `Appel API vers domaine de télémétrie: ${url}`,
        originalCode: match[0],
        recommendation: 'Supprimer cet appel réseau vers un tracker',
        quarantined: true,
      });
    }
  }
  
  return findings;
}

// Detect ghost hooks in config files (using shared SUSPICIOUS_PACKAGES)
function detectGhostHooks(content: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  
  // Check package.json for suspicious packages
  if (fileName === 'package.json') {
    try {
      const pkg = JSON.parse(content);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      
      for (const [depName] of Object.entries(allDeps || {})) {
        if (SUSPICIOUS_PACKAGES.some(pattern => depName.includes(pattern))) {
          findings.push({
            type: 'critical',
            category: 'ghost_hook',
            filePath,
            description: `Package propriétaire détecté: ${depName}`,
            originalCode: `"${depName}"`,
            recommendation: 'Supprimer ce package et ses références du projet',
            quarantined: true,
          });
        }
      }
      
      // Check scripts for suspicious commands (using TELEMETRY_DOMAINS)
      for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts || {})) {
        if (typeof scriptCmd === 'string' && TELEMETRY_DOMAINS.some(domain => scriptCmd.includes(domain))) {
          findings.push({
            type: 'critical',
            category: 'ghost_hook',
            filePath,
            description: `Script avec télémétrie détecté: ${scriptName}`,
            originalCode: `"${scriptName}": "${scriptCmd}"`,
            recommendation: 'Supprimer ou nettoyer ce script',
            quarantined: true,
          });
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  
  // Check vite.config for hidden plugins (using shared HIDDEN_PLUGIN_PATTERNS)
  if (fileName.includes('vite.config')) {
    for (const pattern of HIDDEN_PLUGIN_PATTERNS) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        findings.push({
          type: 'critical',
          category: 'ghost_hook',
          filePath,
          description: 'Plugin Vite suspect détecté',
          originalCode: match?.[0] || 'Pattern matched',
          recommendation: 'Supprimer ce plugin et vérifier la configuration Vite',
          quarantined: true,
        });
      }
    }
  }
  
  // Check for proprietary CDN usage
  for (const cdn of PROPRIETARY_CDNS) {
    if (content.includes(cdn)) {
      const lineNumber = content.split(cdn)[0].split('\n').length;
      findings.push({
        type: 'warning',
        category: 'cdn',
        filePath,
        line: lineNumber,
        description: `CDN propriétaire détecté: ${cdn}`,
        originalCode: cdn,
        recommendation: 'Remplacer par des ressources locales ou un CDN public',
        quarantined: false,
      });
    }
  }
  
  return findings;
}

// Clean the code by removing detected issues (using shared TELEMETRY_DOMAINS)
function cleanCode(content: string, _findings: SecurityFinding[]): string {
  let cleanedContent = content;
  
  // Remove telemetry imports and calls
  for (const domain of TELEMETRY_DOMAINS) {
    // Remove import statements
    const importPattern = new RegExp(`^.*import.*['"\`].*${domain.replace(/\./g, '\\.')}.*['"\`].*$`, 'gm');
    cleanedContent = cleanedContent.replace(importPattern, '// [INOPAY] Télémétrie supprimée');
    
    // Remove URLs
    const urlPattern = new RegExp(`['"\`][^'"\`]*${domain.replace(/\./g, '\\.')}[^'"\`]*['"\`]`, 'gi');
    cleanedContent = cleanedContent.replace(urlPattern, '""');
  }
  
  // Remove eval() calls (replace with comment)
  cleanedContent = cleanedContent.replace(
    /\beval\s*\([^)]*\)/g,
    '/* [INOPAY] eval() supprimé pour sécurité */'
  );
  
  // Remove new Function() calls
  cleanedContent = cleanedContent.replace(
    /new\s+Function\s*\([^)]*\)/g,
    '/* [INOPAY] new Function() supprimé pour sécurité */'
  );
  
  return cleanedContent;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { files, userId, projectId, projectName } = await req.json();

    if (!files || !Array.isArray(files)) {
      return new Response(
        JSON.stringify({ error: 'Files array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const allFindings: SecurityFinding[] = [];
    const quarantinedFiles: string[] = [];
    const cleanedFiles: { path: string; originalContent: string; cleanedContent: string }[] = [];

    console.log(`[verify-zero-shadow-door] Starting security audit for ${files.length} files`);

    for (const file of files) {
      const { path, content } = file;
      
      if (!content || typeof content !== 'string') continue;

      // Skip binary files and node_modules
      if (path.includes('node_modules/') || path.includes('.git/')) continue;
      
      // Run all detection functions
      const findings: SecurityFinding[] = [
        ...detectBase64Obfuscation(content, path),
        ...detectHexObfuscation(content, path),
        ...detectEvalUsage(content, path),
        ...detectTelemetryEndpoints(content, path),
        ...detectGhostHooks(content, path),
      ];

      allFindings.push(...findings);

      // Check if file should be quarantined
      const criticalFindings = findings.filter(f => f.quarantined);
      if (criticalFindings.length > 0) {
        quarantinedFiles.push(path);
        
        // Clean the file
        const cleanedContent = cleanCode(content, criticalFindings);
        if (cleanedContent !== content) {
          cleanedFiles.push({
            path,
            originalContent: content,
            cleanedContent,
          });
        }
      }
    }

    // Calculate summary
    const summary = {
      criticalCount: allFindings.filter(f => f.type === 'critical').length,
      warningCount: allFindings.filter(f => f.type === 'warning').length,
      infoCount: allFindings.filter(f => f.type === 'info').length,
      obfuscationFound: allFindings.filter(f => f.category === 'obfuscation').length,
      telemetryFound: allFindings.filter(f => f.category === 'telemetry').length,
      ghostHooksFound: allFindings.filter(f => f.category === 'ghost_hook').length,
      evalRemoved: allFindings.filter(f => f.category === 'eval').length,
    };

    // Determine certification status
    let certificationStatus: 'sovereign' | 'requires_review' | 'compromised';
    let certificationMessage: string;

    if (summary.criticalCount === 0 && summary.warningCount === 0) {
      certificationStatus = 'sovereign';
      certificationMessage = '✅ Code 100% Souverain - Aucun tracker détecté';
    } else if (summary.criticalCount === 0 && summary.warningCount > 0) {
      certificationStatus = 'requires_review';
      certificationMessage = `⚠️ Code partiellement souverain - ${summary.warningCount} avertissement(s) à vérifier`;
    } else {
      certificationStatus = 'compromised';
      certificationMessage = `🚨 ${summary.criticalCount} problème(s) critique(s) détecté(s) - Nettoyage appliqué`;
    }

    const isSovereign = certificationStatus === 'sovereign';

    // Log to admin activity if critical findings
    if (summary.criticalCount > 0 && userId) {
      await supabase.from('admin_activity_logs').insert({
        user_id: userId,
        action_type: 'security_audit',
        title: `🔒 Audit Sécurité: ${projectName || 'Projet'}`,
        description: `${summary.criticalCount} problème(s) critique(s), ${quarantinedFiles.length} fichier(s) en quarantaine`,
        status: 'warning',
        metadata: {
          projectId,
          projectName,
          findings: summary,
          quarantinedFiles,
        },
      });
    }

    const result: AuditResult = {
      success: true,
      isSovereign,
      totalFilesScanned: files.length,
      findings: allFindings,
      quarantinedFiles,
      cleanedFiles,
      summary,
      certificationStatus,
      certificationMessage,
    };

    console.log(`[verify-zero-shadow-door] Audit complete: ${certificationStatus}`);
    console.log(`[verify-zero-shadow-door] Summary:`, summary);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-zero-shadow-door] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
