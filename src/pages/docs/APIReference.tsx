import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Printer, ArrowLeft, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { toast } from 'sonner';

const APIReference = () => {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const exportToPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('doc-content');
    const opt = {
      margin: [15, 15, 15, 15],
      filename: 'Inopay-Liberator-API-Reference.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    await html2pdf().set(opt).from(element).save();
    setIsExporting(false);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success('Code copié !');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, id, language = 'bash' }: { code: string; id: string; language?: string }) => (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-gray-400 text-sm">{language}</span>
        <button
          onClick={() => copyCode(code, id)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {copiedCode === id ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-100 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-6 py-3 flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimer
          </Button>
          <Button onClick={exportToPDF} disabled={isExporting}>
            <FileDown className="w-4 h-4 mr-2" />
            {isExporting ? 'Export...' : 'Télécharger PDF'}
          </Button>
        </div>
      </div>

      {/* Document Content */}
      <div id="doc-content" className="max-w-4xl mx-auto px-8 py-12 bg-white text-black print:p-0">
        
        {/* Cover Page */}
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center border-b-2 border-gray-200 pb-12 mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
            <span className="text-3xl font-bold text-white">{`</>`}</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">API Reference</h1>
          <h2 className="text-2xl text-gray-600 mb-6">Inopay Liberator</h2>
          <p className="text-lg text-gray-500 max-w-lg">
            Documentation complète de l'API REST pour automatiser vos libérations de projets.
          </p>
          <div className="mt-8 text-sm text-gray-400">
            <p>Version 2.0.0 • {new Date().toLocaleDateString('fr-FR')}</p>
            <p className="mt-2 font-mono bg-gray-100 px-4 py-2 rounded text-gray-600">
              Base URL: https://api.inopay.dev/v1
            </p>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="mb-12 bg-gray-50 rounded-xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📑 Sommaire</h2>
          <nav className="grid grid-cols-2 gap-2 text-sm">
            <a href="#authentication" className="text-blue-600 hover:underline">1. Authentification</a>
            <a href="#endpoints" className="text-blue-600 hover:underline">2. Endpoints</a>
            <a href="#schemas" className="text-blue-600 hover:underline">3. Schemas JSON</a>
            <a href="#webhooks" className="text-blue-600 hover:underline">4. Webhooks</a>
            <a href="#errors" className="text-blue-600 hover:underline">5. Gestion des erreurs</a>
            <a href="#rate-limiting" className="text-blue-600 hover:underline">6. Rate Limiting</a>
            <a href="#security" className="text-blue-600 hover:underline">7. Sécurité</a>
          </nav>
        </div>

        {/* Section 1: Authentication */}
        <section id="authentication" className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-violet-500 pb-4">1. Authentification</h2>
          
          <p className="text-gray-700 leading-relaxed mb-4">
            L'API Inopay Liberator utilise des tokens JWT pour l'authentification. Incluez votre token dans 
            l'en-tête <code className="bg-gray-100 px-2 py-1 rounded">Authorization</code> de chaque requête.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Obtenir un token</h3>
          <CodeBlock 
            id="auth-1"
            code={`curl -X POST https://api.inopay.dev/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'`}
          />

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Réponse</h3>
          <CodeBlock 
            id="auth-2"
            language="json"
            code={`{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2..."
}`}
          />

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Utilisation du token</h3>
          <CodeBlock 
            id="auth-3"
            code={`curl -X GET https://api.inopay.dev/v1/projects \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."`}
          />

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-6">
            <p className="text-blue-800">
              <strong>Note :</strong> Les tokens expirent après 1 heure. Utilisez le <code>refresh_token</code> 
              pour obtenir un nouveau token sans re-authentification.
            </p>
          </div>
        </section>

        {/* Section 2: Endpoints */}
        <section id="endpoints" className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-violet-500 pb-4">2. Endpoints</h2>

          {/* POST /liberate */}
          <div className="mb-12 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-emerald-500 px-4 py-3 flex items-center gap-3">
              <span className="bg-white text-emerald-700 font-bold px-2 py-1 rounded text-sm">POST</span>
              <code className="text-white font-mono">/liberate</code>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Lance un nouveau job de libération de projet.</p>
              
              <h4 className="font-semibold text-gray-800 mb-2">Request Body</h4>
              <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left">Paramètre</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Type</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Requis</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">source</td>
                    <td className="border border-gray-200 px-3 py-2">string</td>
                    <td className="border border-gray-200 px-3 py-2">✓</td>
                    <td className="border border-gray-200 px-3 py-2">"zip" | "github" | "git"</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-mono">data</td>
                    <td className="border border-gray-200 px-3 py-2">string</td>
                    <td className="border border-gray-200 px-3 py-2">✓</td>
                    <td className="border border-gray-200 px-3 py-2">URL ou base64 du fichier</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">projectName</td>
                    <td className="border border-gray-200 px-3 py-2">string</td>
                    <td className="border border-gray-200 px-3 py-2">-</td>
                    <td className="border border-gray-200 px-3 py-2">Nom personnalisé du projet</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-mono">options</td>
                    <td className="border border-gray-200 px-3 py-2">object</td>
                    <td className="border border-gray-200 px-3 py-2">-</td>
                    <td className="border border-gray-200 px-3 py-2">Options de libération</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="font-semibold text-gray-800 mb-2">Options disponibles</h4>
              <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left">Option</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Type</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Défaut</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">cleanAI</td>
                    <td className="border border-gray-200 px-3 py-2">boolean</td>
                    <td className="border border-gray-200 px-3 py-2">true</td>
                    <td className="border border-gray-200 px-3 py-2">Nettoyer les patterns IA</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-mono">generateDocker</td>
                    <td className="border border-gray-200 px-3 py-2">boolean</td>
                    <td className="border border-gray-200 px-3 py-2">true</td>
                    <td className="border border-gray-200 px-3 py-2">Générer Dockerfile</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">generateCI</td>
                    <td className="border border-gray-200 px-3 py-2">boolean</td>
                    <td className="border border-gray-200 px-3 py-2">true</td>
                    <td className="border border-gray-200 px-3 py-2">Générer workflows CI/CD</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-mono">excludePaths</td>
                    <td className="border border-gray-200 px-3 py-2">string[]</td>
                    <td className="border border-gray-200 px-3 py-2">[]</td>
                    <td className="border border-gray-200 px-3 py-2">Chemins à exclure</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="font-semibold text-gray-800 mb-2">Exemple cURL</h4>
              <CodeBlock 
                id="liberate-1"
                code={`curl -X POST https://api.inopay.dev/v1/liberate \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "github",
    "data": "https://github.com/user/my-lovable-project",
    "projectName": "my-sovereign-app",
    "options": {
      "cleanAI": true,
      "generateDocker": true,
      "generateCI": true
    }
  }'`}
              />

              <h4 className="font-semibold text-gray-800 mb-2">Réponse (201 Created)</h4>
              <CodeBlock 
                id="liberate-2"
                language="json"
                code={`{
  "liberationId": "lib_abc123xyz",
  "status": "processing",
  "progress": 0,
  "createdAt": "2024-01-15T10:30:00Z",
  "estimatedDuration": 180
}`}
              />
            </div>
          </div>

          {/* GET /audit/:id */}
          <div className="mb-12 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-blue-500 px-4 py-3 flex items-center gap-3">
              <span className="bg-white text-blue-700 font-bold px-2 py-1 rounded text-sm">GET</span>
              <code className="text-white font-mono">/audit/{'{id}'}</code>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Récupère le rapport d'audit d'une libération.</p>
              
              <h4 className="font-semibold text-gray-800 mb-2">Paramètres URL</h4>
              <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left">Paramètre</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Type</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">id</td>
                    <td className="border border-gray-200 px-3 py-2">string</td>
                    <td className="border border-gray-200 px-3 py-2">ID de la libération</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="font-semibold text-gray-800 mb-2">Exemple cURL</h4>
              <CodeBlock 
                id="audit-1"
                code={`curl -X GET https://api.inopay.dev/v1/audit/lib_abc123xyz \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
              />

              <h4 className="font-semibold text-gray-800 mb-2">Réponse (200 OK)</h4>
              <CodeBlock 
                id="audit-2"
                language="json"
                code={`{
  "id": "lib_abc123xyz",
  "status": "audit_ready",
  "progress": 25,
  "audit": {
    "score": 45,
    "totalFiles": 127,
    "issuesFound": 23,
    "issues": [
      {
        "severity": "critical",
        "file": "src/integrations/supabase/client.ts",
        "line": 5,
        "pattern": "lovable-tagger",
        "suggestion": "Supprimer l'import lovable-tagger"
      },
      {
        "severity": "warning",
        "file": "src/lib/ai.ts",
        "line": 12,
        "pattern": "openai-api",
        "suggestion": "Remplacer par Ollama endpoint"
      }
    ]
  },
  "stats": {
    "proprietaryPatterns": 15,
    "telemetryTrackers": 3,
    "aiDependencies": 5
  }
}`}
              />
            </div>
          </div>

          {/* POST /clean/:id */}
          <div className="mb-12 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-emerald-500 px-4 py-3 flex items-center gap-3">
              <span className="bg-white text-emerald-700 font-bold px-2 py-1 rounded text-sm">POST</span>
              <code className="text-white font-mono">/clean/{'{id}'}</code>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Démarre le processus de nettoyage automatique.</p>
              
              <h4 className="font-semibold text-gray-800 mb-2">Exemple cURL</h4>
              <CodeBlock 
                id="clean-1"
                code={`curl -X POST https://api.inopay.dev/v1/clean/lib_abc123xyz \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "excludeIssues": ["issue_id_to_skip"],
    "customReplacements": {
      "openai": "ollama"
    }
  }'`}
              />

              <h4 className="font-semibold text-gray-800 mb-2">Réponse (202 Accepted)</h4>
              <CodeBlock 
                id="clean-2"
                language="json"
                code={`{
  "id": "lib_abc123xyz",
  "status": "cleaning",
  "progress": 0,
  "estimatedDuration": 120
}`}
              />
            </div>
          </div>

          {/* GET /download/:id */}
          <div className="mb-12 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-blue-500 px-4 py-3 flex items-center gap-3">
              <span className="bg-white text-blue-700 font-bold px-2 py-1 rounded text-sm">GET</span>
              <code className="text-white font-mono">/download/{'{id}'}</code>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Télécharge le package souverain généré.</p>
              
              <h4 className="font-semibold text-gray-800 mb-2">Exemple cURL</h4>
              <CodeBlock 
                id="download-1"
                code={`curl -X GET https://api.inopay.dev/v1/download/lib_abc123xyz \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -o inopay-liberation-package.zip`}
              />

              <h4 className="font-semibold text-gray-800 mb-2">Réponse</h4>
              <p className="text-gray-600 text-sm">
                Retourne le fichier ZIP directement (Content-Type: application/zip)
              </p>
            </div>
          </div>

          {/* POST /deploy/:id */}
          <div className="mb-12 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-emerald-500 px-4 py-3 flex items-center gap-3">
              <span className="bg-white text-emerald-700 font-bold px-2 py-1 rounded text-sm">POST</span>
              <code className="text-white font-mono">/deploy/{'{id}'}</code>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Déploie automatiquement le projet sur un serveur configuré.</p>
              
              <h4 className="font-semibold text-gray-800 mb-2">Request Body</h4>
              <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left">Paramètre</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Type</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">serverId</td>
                    <td className="border border-gray-200 px-3 py-2">string</td>
                    <td className="border border-gray-200 px-3 py-2">ID du serveur cible</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-mono">domain</td>
                    <td className="border border-gray-200 px-3 py-2">string</td>
                    <td className="border border-gray-200 px-3 py-2">Domaine personnalisé (optionnel)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">envVars</td>
                    <td className="border border-gray-200 px-3 py-2">object</td>
                    <td className="border border-gray-200 px-3 py-2">Variables d'environnement</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="font-semibold text-gray-800 mb-2">Exemple cURL</h4>
              <CodeBlock 
                id="deploy-1"
                code={`curl -X POST https://api.inopay.dev/v1/deploy/lib_abc123xyz \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serverId": "srv_myserver123",
    "domain": "myapp.example.com",
    "envVars": {
      "DATABASE_URL": "postgresql://...",
      "API_KEY": "sk_..."
    }
  }'`}
              />
            </div>
          </div>

          {/* GET /status/:id */}
          <div className="mb-12 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-blue-500 px-4 py-3 flex items-center gap-3">
              <span className="bg-white text-blue-700 font-bold px-2 py-1 rounded text-sm">GET</span>
              <code className="text-white font-mono">/status/{'{id}'}</code>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Récupère le statut actuel d'une libération.</p>
              
              <h4 className="font-semibold text-gray-800 mb-2">Réponse (200 OK)</h4>
              <CodeBlock 
                id="status-1"
                language="json"
                code={`{
  "id": "lib_abc123xyz",
  "status": "completed",
  "progress": 100,
  "stages": {
    "upload": { "status": "completed", "duration": 5 },
    "audit": { "status": "completed", "duration": 30 },
    "clean": { "status": "completed", "duration": 120 },
    "build": { "status": "completed", "duration": 45 },
    "package": { "status": "completed", "duration": 10 }
  },
  "downloadUrl": "/download/lib_abc123xyz",
  "completedAt": "2024-01-15T10:35:00Z"
}`}
              />
            </div>
          </div>
        </section>

        {/* Section 3: Schemas */}
        <section id="schemas" className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-violet-500 pb-4">3. Schemas JSON</h2>

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">LiberationJob</h3>
          <CodeBlock 
            id="schema-1"
            language="json"
            code={`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "pattern": "^lib_[a-z0-9]+$" },
    "userId": { "type": "string", "format": "uuid" },
    "projectName": { "type": "string", "minLength": 1, "maxLength": 100 },
    "sourceType": { "enum": ["zip", "github", "git"] },
    "sourceUrl": { "type": "string", "format": "uri" },
    "status": { 
      "enum": ["pending", "processing", "audit_ready", "cleaning", "building", "completed", "failed"] 
    },
    "progress": { "type": "integer", "minimum": 0, "maximum": 100 },
    "auditReport": { "$ref": "#/definitions/AuditReport" },
    "resultUrl": { "type": "string", "format": "uri" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "completedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "userId", "sourceType", "status"]
}`}
          />

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">AuditIssue</h3>
          <CodeBlock 
            id="schema-2"
            language="json"
            code={`{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "severity": { "enum": ["info", "warning", "critical"] },
    "file": { "type": "string" },
    "line": { "type": "integer", "minimum": 1 },
    "column": { "type": "integer", "minimum": 0 },
    "pattern": { "type": "string" },
    "patternType": { 
      "enum": ["import", "telemetry", "ai", "config", "dependency"] 
    },
    "suggestion": { "type": "string" },
    "autoFixable": { "type": "boolean" }
  },
  "required": ["id", "severity", "file", "pattern"]
}`}
          />
        </section>

        {/* Section 4: Webhooks */}
        <section id="webhooks" className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-violet-500 pb-4">4. Webhooks</h2>
          
          <p className="text-gray-700 leading-relaxed mb-4">
            Configurez des webhooks pour recevoir des notifications en temps réel sur l'état de vos libérations.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Configuration</h3>
          <CodeBlock 
            id="webhook-1"
            code={`curl -X POST https://api.inopay.dev/v1/webhooks \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["liberation.started", "liberation.completed", "liberation.failed"],
    "secret": "whsec_your_signing_secret"
  }'`}
          />

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Événements disponibles</h3>
          <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">Événement</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">liberation.started</td>
                <td className="border border-gray-200 px-3 py-2">Libération démarrée</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">liberation.audit_ready</td>
                <td className="border border-gray-200 px-3 py-2">Audit terminé</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">liberation.cleaning</td>
                <td className="border border-gray-200 px-3 py-2">Nettoyage en cours</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">liberation.completed</td>
                <td className="border border-gray-200 px-3 py-2">Libération terminée avec succès</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">liberation.failed</td>
                <td className="border border-gray-200 px-3 py-2">Libération échouée</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">deployment.started</td>
                <td className="border border-gray-200 px-3 py-2">Déploiement démarré</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">deployment.completed</td>
                <td className="border border-gray-200 px-3 py-2">Déploiement terminé</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Payload d'exemple</h3>
          <CodeBlock 
            id="webhook-2"
            language="json"
            code={`{
  "id": "evt_12345",
  "type": "liberation.completed",
  "created": "2024-01-15T10:35:00Z",
  "data": {
    "liberationId": "lib_abc123xyz",
    "projectName": "my-sovereign-app",
    "status": "completed",
    "downloadUrl": "https://api.inopay.dev/v1/download/lib_abc123xyz",
    "stats": {
      "filesProcessed": 127,
      "issuesFixed": 23,
      "duration": 210
    }
  }
}`}
          />

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Vérification de signature</h3>
          <CodeBlock 
            id="webhook-3"
            language="javascript"
            code={`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(\`sha256=\${expectedSignature}\`)
  );
}`}
          />
        </section>

        {/* Section 5: Errors */}
        <section id="errors" className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-violet-500 pb-4">5. Gestion des erreurs</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Format des erreurs</h3>
          <CodeBlock 
            id="error-1"
            language="json"
            code={`{
  "error": {
    "code": "INVALID_SOURCE",
    "message": "The provided source URL is not accessible",
    "details": {
      "url": "https://github.com/...",
      "reason": "Repository not found or private"
    }
  },
  "requestId": "req_xyz123"
}`}
          />

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Codes d'erreur HTTP</h3>
          <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">Code</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Signification</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">400</td>
                <td className="border border-gray-200 px-3 py-2">Bad Request</td>
                <td className="border border-gray-200 px-3 py-2">Vérifier les paramètres</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">401</td>
                <td className="border border-gray-200 px-3 py-2">Unauthorized</td>
                <td className="border border-gray-200 px-3 py-2">Vérifier le token</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">403</td>
                <td className="border border-gray-200 px-3 py-2">Forbidden</td>
                <td className="border border-gray-200 px-3 py-2">Vérifier les permissions</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">404</td>
                <td className="border border-gray-200 px-3 py-2">Not Found</td>
                <td className="border border-gray-200 px-3 py-2">Ressource inexistante</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">422</td>
                <td className="border border-gray-200 px-3 py-2">Unprocessable Entity</td>
                <td className="border border-gray-200 px-3 py-2">Données invalides</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">429</td>
                <td className="border border-gray-200 px-3 py-2">Too Many Requests</td>
                <td className="border border-gray-200 px-3 py-2">Rate limit atteint</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">500</td>
                <td className="border border-gray-200 px-3 py-2">Internal Server Error</td>
                <td className="border border-gray-200 px-3 py-2">Réessayer plus tard</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Codes d'erreur métier</h3>
          <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">Code</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">INVALID_SOURCE</td>
                <td className="border border-gray-200 px-3 py-2">Source invalide ou inaccessible</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">UNSUPPORTED_FORMAT</td>
                <td className="border border-gray-200 px-3 py-2">Format de fichier non supporté</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">PROJECT_TOO_LARGE</td>
                <td className="border border-gray-200 px-3 py-2">Projet excède la limite de taille</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">BUILD_FAILED</td>
                <td className="border border-gray-200 px-3 py-2">Échec de la compilation</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">QUOTA_EXCEEDED</td>
                <td className="border border-gray-200 px-3 py-2">Quota de libérations atteint</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 6: Rate Limiting */}
        <section id="rate-limiting" className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-violet-500 pb-4">6. Rate Limiting</h2>
          
          <p className="text-gray-700 leading-relaxed mb-4">
            L'API applique des limites de requêtes pour garantir la stabilité du service.
          </p>

          <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">Endpoint</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Limite</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Fenêtre</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">POST /liberate</td>
                <td className="border border-gray-200 px-3 py-2">10 requêtes</td>
                <td className="border border-gray-200 px-3 py-2">1 heure</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">GET /audit/:id</td>
                <td className="border border-gray-200 px-3 py-2">100 requêtes</td>
                <td className="border border-gray-200 px-3 py-2">1 minute</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">GET /download/:id</td>
                <td className="border border-gray-200 px-3 py-2">20 requêtes</td>
                <td className="border border-gray-200 px-3 py-2">1 heure</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">Autres endpoints</td>
                <td className="border border-gray-200 px-3 py-2">60 requêtes</td>
                <td className="border border-gray-200 px-3 py-2">1 minute</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">En-têtes de réponse</h3>
          <table className="w-full border-collapse border border-gray-200 mb-4 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">Header</th>
                <th className="border border-gray-200 px-3 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">X-RateLimit-Limit</td>
                <td className="border border-gray-200 px-3 py-2">Nombre max de requêtes autorisées</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono">X-RateLimit-Remaining</td>
                <td className="border border-gray-200 px-3 py-2">Requêtes restantes</td>
              </tr>
              <tr>
                <td className="border border-gray-200 px-3 py-2 font-mono">X-RateLimit-Reset</td>
                <td className="border border-gray-200 px-3 py-2">Timestamp de reset (Unix)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 7: Security */}
        <section id="security" className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-violet-500 pb-4">7. Sécurité</h2>
          
          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Standards appliqués</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>HTTPS obligatoire</strong> : Toutes les communications sont chiffrées (TLS 1.3)</li>
            <li><strong>JWT RS256</strong> : Tokens signés avec RSA-SHA256</li>
            <li><strong>CORS configuré</strong> : Origines autorisées uniquement</li>
            <li><strong>Validation des entrées</strong> : Zod schemas pour toutes les requêtes</li>
            <li><strong>Audit logging</strong> : Toutes les actions sont tracées</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Bonnes pratiques</h3>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-800 font-semibold">⚠️ Ne jamais :</p>
            <ul className="list-disc list-inside text-red-700 space-y-1 ml-4 mt-2">
              <li>Exposer vos tokens dans le code source</li>
              <li>Logger les tokens ou secrets</li>
              <li>Utiliser des tokens en clair dans les URLs</li>
            </ul>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <p className="text-green-800 font-semibold">✅ Toujours :</p>
            <ul className="list-disc list-inside text-green-700 space-y-1 ml-4 mt-2">
              <li>Stocker les tokens dans des variables d'environnement</li>
              <li>Utiliser HTTPS en production</li>
              <li>Renouveler régulièrement les tokens</li>
              <li>Vérifier les signatures des webhooks</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-gray-200 pt-8 mt-16 text-center text-gray-500">
          <p className="mb-2">Inopay Liberator – API Reference v2.0.0</p>
          <p>© {new Date().getFullYear()} Inovaq Canada Inc. Tous droits réservés.</p>
          <p className="mt-4 text-sm">
            Support API : api-support@inopay.dev | Status : status.inopay.dev
          </p>
        </footer>
      </div>
    </div>
  );
};

export default APIReference;
