import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Printer, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';

const OfficialDocumentation = () => {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('doc-content');
    const opt = {
      margin: [15, 15, 15, 15],
      filename: 'Inopay-Liberator-Documentation-Officielle.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    await html2pdf().set(opt).from(element).save();
    setIsExporting(false);
  };

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
        <div className="min-h-[90vh] flex flex-col items-center justify-center text-center border-b-2 border-gray-200 pb-16 mb-16">
          <div className="w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl">
            <span className="text-4xl font-bold text-white">INO</span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Inopay Liberator</h1>
          <h2 className="text-2xl text-gray-600 mb-8">Documentation Officielle</h2>
          <p className="text-xl text-emerald-600 italic mb-12">
            "Libérez vos projets. Déployez sans contraintes."
          </p>
          <div className="text-gray-500">
            <p className="text-lg font-semibold">Version PaaS Universel</p>
            <p>Version 2.0.0 • {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="mt-16 text-sm text-gray-400">
            © {new Date().getFullYear()} Inovaq Canada Inc. Tous droits réservés.
          </div>
        </div>

        {/* Table of Contents */}
        <div className="mb-16 page-break-after">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 border-b-2 border-emerald-500 pb-4">Table des matières</h2>
          <nav className="space-y-2 text-lg">
            <div className="flex justify-between border-b border-dotted border-gray-300 py-2">
              <span>1. Introduction</span><span className="text-gray-500">3</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-gray-300 py-2">
              <span>2. Concepts clés</span><span className="text-gray-500">5</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-gray-300 py-2">
              <span>3. Fonctionnalités principales</span><span className="text-gray-500">8</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-gray-300 py-2">
              <span>4. Guide utilisateur : UI Inopay Liberator</span><span className="text-gray-500">12</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-gray-300 py-2">
              <span>5. Guide technique</span><span className="text-gray-500">18</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-gray-300 py-2">
              <span>6. Guide d'intégration</span><span className="text-gray-500">24</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-gray-300 py-2">
              <span>7. Annexes</span><span className="text-gray-500">30</span>
            </div>
          </nav>
        </div>

        {/* Chapter 1: Introduction */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-emerald-500 pb-4">1. Introduction</h2>
          
          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">1.1 Vision du projet</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Inopay Liberator est né d'une conviction simple : <strong>votre code vous appartient</strong>. Dans un écosystème 
            de développement dominé par des plateformes propriétaires, nous offrons une voie vers la souveraineté numérique.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            Notre plateforme permet de libérer n'importe quel projet des dépendances propriétaires, de le nettoyer, 
            le reconstruire, et le déployer sur l'infrastructure de votre choix — que ce soit un VPS personnel, 
            un cluster Kubernetes, ou tout autre cloud provider.
          </p>
          
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 my-8">
            <h4 className="font-semibold text-emerald-800 mb-2">🎯 Mission</h4>
            <p className="text-emerald-700">
              Permettre à chaque développeur, startup et entreprise de reprendre le contrôle total de leur code 
              et de leur infrastructure, sans compromis sur la qualité ou la sécurité.
            </p>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">1.2 Pourquoi un Liberator PaaS ?</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Les plateformes de développement modernes offrent une expérience utilisateur exceptionnelle, mais 
            créent souvent une dépendance technique difficile à rompre. Inopay Liberator résout ce problème en :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mb-6">
            <li>Détectant automatiquement les patterns propriétaires dans votre code</li>
            <li>Remplaçant ces patterns par des alternatives open-source équivalentes</li>
            <li>Générant un package prêt à déployer sur n'importe quelle infrastructure</li>
            <li>Fournissant des pipelines CI/CD universels et configurables</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">1.3 Auto-libération : Inopay libère Inopay</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Pour valider notre approche, nous utilisons Inopay Liberator pour libérer... Inopay lui-même. 
            Ce processus d'auto-libération garantit que :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Notre outil fonctionne sur des projets réels et complexes</li>
            <li>Les patterns détectés sont exhaustifs et précis</li>
            <li>Le code généré est fonctionnel et déployable</li>
            <li>Nous pratiquons ce que nous prêchons</li>
          </ul>
        </section>

        {/* Chapter 2: Key Concepts */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-emerald-500 pb-4">2. Concepts clés</h2>
          
          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">2.1 Définition : "Liberator"</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Le terme <strong>Liberator</strong> désigne le processus complet de transformation d'un projet 
            dépendant d'une plateforme propriétaire en un projet 100% autonome et portable.
          </p>
          
          <div className="bg-gray-100 p-6 rounded-lg my-6 font-mono text-sm">
            <pre className="whitespace-pre-wrap">{`
┌─────────────────────────────────────────────────────────────┐
│                    LIBERATION WORKFLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   [Projet Source]  ──▶  [Scan]  ──▶  [Audit]                │
│         │                              │                     │
│         │                              ▼                     │
│         │                      [Détection Patterns]         │
│         │                              │                     │
│         │                              ▼                     │
│         │                      [Nettoyage Code]             │
│         │                              │                     │
│         │                              ▼                     │
│         │                      [Reconstruction]              │
│         │                              │                     │
│         │                              ▼                     │
│         └──────────────▶     [Package Souverain]            │
│                                        │                     │
│                                        ▼                     │
│                              [Déploiement VPS]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
            `}</pre>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">2.2 Architecture PaaS</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Inopay Liberator est conçu comme un Platform-as-a-Service (PaaS) universel qui s'adapte 
            à n'importe quel type de projet :
          </p>
          
          <table className="w-full border-collapse border border-gray-300 my-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Composant</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Technologie</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-semibold">Scanner</td>
                <td className="border border-gray-300 px-4 py-2">Analyse statique du code source</td>
                <td className="border border-gray-300 px-4 py-2">AST Parser, Regex Engine</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-semibold">Cleaner</td>
                <td className="border border-gray-300 px-4 py-2">Nettoyage et remplacement des patterns</td>
                <td className="border border-gray-300 px-4 py-2">TypeScript, AI-assisted</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-semibold">Rebuilder</td>
                <td className="border border-gray-300 px-4 py-2">Reconstruction du projet</td>
                <td className="border border-gray-300 px-4 py-2">Vite, Docker</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-semibold">Packager</td>
                <td className="border border-gray-300 px-4 py-2">Génération du package final</td>
                <td className="border border-gray-300 px-4 py-2">ZIP, Docker Images</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-semibold">Deployer</td>
                <td className="border border-gray-300 px-4 py-2">Déploiement automatisé</td>
                <td className="border border-gray-300 px-4 py-2">SSH, Docker Compose</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">2.3 CI/CD Automatique</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Chaque libération génère automatiquement des fichiers de configuration CI/CD compatibles avec :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>GitHub Actions</strong> : Workflows complets pour build, test et déploiement</li>
            <li><strong>GitLab CI</strong> : Pipelines multi-stages avec Docker-in-Docker</li>
            <li><strong>Jenkins</strong> : Jenkinsfile déclaratif (optionnel)</li>
            <li><strong>Scripts autonomes</strong> : Pour les environnements sans CI/CD</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">2.4 Pipeline de libération (Étapes A → D)</h3>
          
          <div className="space-y-6 my-8">
            <div className="border-l-4 border-blue-500 pl-6">
              <h4 className="font-bold text-blue-800 text-lg">Étape A : Analyse</h4>
              <p className="text-gray-700">Scan complet du projet, détection des patterns propriétaires, génération du rapport d'audit.</p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-6">
              <h4 className="font-bold text-yellow-800 text-lg">Étape B : Nettoyage</h4>
              <p className="text-gray-700">Suppression des dépendances non-souveraines, remplacement par des alternatives open-source.</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-6">
              <h4 className="font-bold text-orange-800 text-lg">Étape C : Construction</h4>
              <p className="text-gray-700">Rebuild du projet avec les nouvelles dépendances, génération des assets, validation.</p>
            </div>
            <div className="border-l-4 border-emerald-500 pl-6">
              <h4 className="font-bold text-emerald-800 text-lg">Étape D : Déploiement</h4>
              <p className="text-gray-700">Packaging final, génération Docker, scripts d'installation, déploiement sur infrastructure cible.</p>
            </div>
          </div>
        </section>

        {/* Chapter 3: Main Features */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-emerald-500 pb-4">3. Fonctionnalités principales</h2>
          
          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">3.1 Extraction du code</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Le système supporte plusieurs méthodes d'importation :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Upload de fichier ZIP</li>
            <li>Connexion directe à un repository GitHub</li>
            <li>Clone depuis n'importe quel Git remote</li>
            <li>Import via URL publique</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">3.2 Nettoyage / Normalisation</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Le moteur de nettoyage détecte et traite automatiquement :
          </p>
          
          <table className="w-full border-collapse border border-gray-300 my-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Pattern détecté</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Remplacement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">@lovable/</td>
                <td className="border border-gray-300 px-4 py-2">Suppression ou équivalent OSS</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">lovable-tagger</td>
                <td className="border border-gray-300 px-4 py-2">Suppression complète</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">GPT-4 / Claude API</td>
                <td className="border border-gray-300 px-4 py-2">Ollama / LM Studio / OpenWebUI</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">Supabase Edge Functions</td>
                <td className="border border-gray-300 px-4 py-2">Express.js / Fastify endpoints</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">Telemetry trackers</td>
                <td className="border border-gray-300 px-4 py-2">Suppression ou auto-hébergé</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">3.3 Reconstruction automatique</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Après nettoyage, le projet est reconstruit avec :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Validation TypeScript complète</li>
            <li>Résolution des dépendances manquantes</li>
            <li>Optimisation du bundle (tree-shaking, minification)</li>
            <li>Génération des assets statiques</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">3.4 Fichiers générés</h3>
          
          <div className="bg-gray-100 p-6 rounded-lg my-6 font-mono text-sm">
            <p className="font-bold mb-2"># Structure du package généré</p>
            <pre className="whitespace-pre-wrap">{`
inopay-liberation-package/
├── dist/                    # Build optimisé
├── backend/                 # API Express (si applicable)
├── Dockerfile              # Image Docker multi-stage
├── Dockerfile.backend      # Backend containerisé
├── docker-compose.yml      # Orchestration complète
├── .env.example            # Variables d'environnement
├── .github/
│   └── workflows/
│       ├── ci.yml          # Pipeline CI
│       └── deploy.yml      # Pipeline CD
├── .gitlab-ci.yml          # Alternative GitLab
├── nginx.conf              # Configuration reverse proxy
├── install.sh              # Script d'installation auto
├── DEPLOY.md               # Guide de déploiement
└── CHANGELOG.md            # Journal des modifications
            `}</pre>
          </div>
        </section>

        {/* Chapter 4: User Guide */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-emerald-500 pb-4">4. Guide utilisateur : UI Inopay Liberator</h2>
          
          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4.1 Dashboard</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Le dashboard principal affiche :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>Statistiques globales</strong> : Nombre de projets libérés, fichiers traités, temps économisé</li>
            <li><strong>Projets récents</strong> : Accès rapide aux dernières libérations</li>
            <li><strong>Pipeline visuel</strong> : État en temps réel des étapes de libération</li>
            <li><strong>Actions rapides</strong> : Import, Audit, Déploiement</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4.2 Import de projet</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Trois méthodes d'import disponibles :
          </p>
          <ol className="list-decimal list-inside text-gray-700 space-y-4 ml-4">
            <li>
              <strong>Upload ZIP</strong><br/>
              <span className="text-gray-600">Glissez-déposez votre archive ou cliquez pour sélectionner un fichier .zip</span>
            </li>
            <li>
              <strong>Connexion GitHub</strong><br/>
              <span className="text-gray-600">Autorisez l'accès et sélectionnez le repository à libérer</span>
            </li>
            <li>
              <strong>URL Git</strong><br/>
              <span className="text-gray-600">Collez l'URL de n'importe quel repository Git public ou privé</span>
            </li>
          </ol>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4.3 Sélection du runtime</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Inopay détecte automatiquement le runtime, mais vous pouvez le configurer manuellement :
          </p>
          <table className="w-full border-collapse border border-gray-300 my-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Runtime</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Détection auto</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Base Image Docker</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Node.js / React</td>
                <td className="border border-gray-300 px-4 py-2">package.json</td>
                <td className="border border-gray-300 px-4 py-2">node:20-alpine</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Next.js</td>
                <td className="border border-gray-300 px-4 py-2">next.config.js</td>
                <td className="border border-gray-300 px-4 py-2">node:20-alpine</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Python / FastAPI</td>
                <td className="border border-gray-300 px-4 py-2">requirements.txt</td>
                <td className="border border-gray-300 px-4 py-2">python:3.11-slim</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Go</td>
                <td className="border border-gray-300 px-4 py-2">go.mod</td>
                <td className="border border-gray-300 px-4 py-2">golang:1.21-alpine</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4.4 Configuration du build</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Options de configuration disponibles :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li><strong>Variables d'environnement</strong> : Définir les secrets et configurations</li>
            <li><strong>Ports exposés</strong> : Configurer les ports HTTP/HTTPS</li>
            <li><strong>Volumes</strong> : Persistance des données</li>
            <li><strong>Healthchecks</strong> : Endpoints de monitoring</li>
            <li><strong>Ressources</strong> : Limites CPU/RAM pour Docker</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4.5 Génération du package</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Le package généré inclut tout le nécessaire pour un déploiement autonome :
          </p>
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 my-6">
            <p className="text-emerald-700">
              <strong>💡 Tip :</strong> Le package est conçu pour être "zero-config". 
              Il suffit de l'extraire et d'exécuter <code className="bg-emerald-100 px-2 py-1 rounded">./install.sh</code>.
            </p>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4.6 Déploiement sur VPS</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Méthodes de déploiement supportées :
          </p>
          <ol className="list-decimal list-inside text-gray-700 space-y-4 ml-4">
            <li>
              <strong>Déploiement automatique (SSH)</strong><br/>
              <span className="text-gray-600">Configurez vos credentials et déployez en un clic</span>
            </li>
            <li>
              <strong>Téléchargement + Installation manuelle</strong><br/>
              <span className="text-gray-600">Téléchargez le ZIP et suivez le guide DEPLOY.md</span>
            </li>
            <li>
              <strong>Intégration CI/CD</strong><br/>
              <span className="text-gray-600">Utilisez les workflows GitHub/GitLab générés</span>
            </li>
          </ol>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">4.7 Surveillance et logs</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Le dashboard de monitoring offre :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>État de santé en temps réel</li>
            <li>Logs des containers Docker</li>
            <li>Métriques de performance</li>
            <li>Alertes automatiques</li>
            <li>Historique des déploiements</li>
          </ul>
        </section>

        {/* Chapter 5: Technical Guide */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-emerald-500 pb-4">5. Guide technique</h2>
          
          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">5.1 Architecture microservices</h3>
          
          <div className="bg-gray-100 p-6 rounded-lg my-6 font-mono text-sm">
            <pre className="whitespace-pre-wrap">{`
┌───────────────────────────────────────────────────────────────────┐
│                      INOPAY LIBERATOR ARCHITECTURE                │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │   Frontend  │    │  API Gateway │    │  Database   │           │
│  │   (React)   │◄──►│  (Express)   │◄──►│ (PostgreSQL)│           │
│  └─────────────┘    └──────┬──────┘    └─────────────┘           │
│                            │                                      │
│         ┌──────────────────┼──────────────────┐                  │
│         │                  │                  │                   │
│         ▼                  ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │   Scanner   │    │   Cleaner   │    │  Packager   │           │
│  │   Worker    │    │   Worker    │    │   Worker    │           │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
│         │                  │                  │                   │
│         └──────────────────┼──────────────────┘                  │
│                            ▼                                      │
│                     ┌─────────────┐                              │
│                     │   Storage   │                              │
│                     │   (S3/Minio)│                              │
│                     └─────────────┘                              │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
            `}</pre>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">5.2 Description API interne</h3>
          <table className="w-full border-collapse border border-gray-300 my-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Endpoint</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Méthode</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">/api/liberate</td>
                <td className="border border-gray-300 px-4 py-2">POST</td>
                <td className="border border-gray-300 px-4 py-2">Lance une libération</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">/api/audit/:id</td>
                <td className="border border-gray-300 px-4 py-2">GET</td>
                <td className="border border-gray-300 px-4 py-2">Récupère le rapport d'audit</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">/api/clean/:id</td>
                <td className="border border-gray-300 px-4 py-2">POST</td>
                <td className="border border-gray-300 px-4 py-2">Démarre le nettoyage</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">/api/download/:id</td>
                <td className="border border-gray-300 px-4 py-2">GET</td>
                <td className="border border-gray-300 px-4 py-2">Télécharge le package</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm">/api/deploy/:id</td>
                <td className="border border-gray-300 px-4 py-2">POST</td>
                <td className="border border-gray-300 px-4 py-2">Déploie sur VPS</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">5.3 Secrets management</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Les secrets sont gérés de manière sécurisée :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Chiffrement AES-256-GCM en base de données</li>
            <li>Vault HashiCorp pour les environnements critiques</li>
            <li>Variables d'environnement injectées au runtime</li>
            <li>Rotation automatique des clés</li>
          </ul>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">5.4 Sécurité</h3>
          <div className="bg-red-50 border-l-4 border-red-500 p-6 my-6">
            <h4 className="font-semibold text-red-800 mb-2">⚠️ Points de sécurité critiques</h4>
            <ul className="list-disc list-inside text-red-700 space-y-1">
              <li>Authentification JWT avec refresh tokens</li>
              <li>Rate limiting sur toutes les routes API</li>
              <li>Validation des inputs avec Zod</li>
              <li>Isolation des workspaces par utilisateur</li>
              <li>Scan antivirus des fichiers uploadés</li>
            </ul>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">5.5 Workers de build</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            Les workers sont des processus isolés qui exécutent les tâches lourdes :
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Exécution dans des containers Docker éphémères</li>
            <li>Timeout configurable (défaut: 10 minutes)</li>
            <li>Queue Redis pour la gestion des jobs</li>
            <li>Retry automatique en cas d'échec</li>
          </ul>
        </section>

        {/* Chapter 6: Integration Guide */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-emerald-500 pb-4">6. Guide d'intégration</h2>
          
          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">6.1 Libérer un projet Lovable</h3>
          <ol className="list-decimal list-inside text-gray-700 space-y-4 ml-4">
            <li>Exportez votre projet depuis Lovable (ZIP ou GitHub)</li>
            <li>Uploadez le projet sur Inopay Liberator</li>
            <li>Lancez l'audit automatique</li>
            <li>Validez les modifications proposées</li>
            <li>Téléchargez le package libéré</li>
            <li>Déployez sur votre VPS</li>
          </ol>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">6.2 Libérer n'importe quel projet Git</h3>
          <div className="bg-gray-100 p-6 rounded-lg my-6 font-mono text-sm">
            <pre className="whitespace-pre-wrap">{`
# Via l'API
curl -X POST https://api.inopay.dev/liberate \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "github",
    "data": "https://github.com/user/repo",
    "options": {
      "cleanAI": true,
      "generateDocker": true
    }
  }'
            `}</pre>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">6.3 Déploiement multi-plateforme</h3>
          
          <h4 className="text-xl font-semibold text-gray-700 mt-6 mb-3">VPS (Ubuntu/Debian)</h4>
          <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm mb-4">
            <pre>{`
# Installation rapide
curl -sSL https://inopay.dev/install.sh | sudo bash

# Ou manuellement
unzip inopay-liberation-package.zip
cd inopay-liberation-package
docker-compose up -d
            `}</pre>
          </div>

          <h4 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Docker Standalone</h4>
          <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm mb-4">
            <pre>{`
docker build -t my-app .
docker run -d -p 80:80 my-app
            `}</pre>
          </div>

          <h4 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Kubernetes</h4>
          <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm mb-4">
            <pre>{`
# Appliquer les manifests générés
kubectl apply -f k8s/

# Vérifier le déploiement
kubectl get pods -n my-app
            `}</pre>
          </div>

          <h4 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Cloud Providers</h4>
          <table className="w-full border-collapse border border-gray-300 my-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Provider</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Service recommandé</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">DigitalOcean</td>
                <td className="border border-gray-300 px-4 py-2">Droplet + Docker</td>
                <td className="border border-gray-300 px-4 py-2">À partir de 4$/mois</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">AWS</td>
                <td className="border border-gray-300 px-4 py-2">EC2 / ECS / EKS</td>
                <td className="border border-gray-300 px-4 py-2">Free tier disponible</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Hetzner</td>
                <td className="border border-gray-300 px-4 py-2">Cloud Server</td>
                <td className="border border-gray-300 px-4 py-2">Meilleur rapport qualité/prix</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">OVH</td>
                <td className="border border-gray-300 px-4 py-2">VPS / Bare Metal</td>
                <td className="border border-gray-300 px-4 py-2">Serveurs EU</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Chapter 7: Annexes */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-emerald-500 pb-4">7. Annexes</h2>
          
          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">7.1 Glossaire</h3>
          <dl className="space-y-4">
            <div>
              <dt className="font-bold text-gray-800">Libération</dt>
              <dd className="text-gray-600 ml-4">Processus de suppression des dépendances propriétaires d'un projet</dd>
            </div>
            <div>
              <dt className="font-bold text-gray-800">Pattern propriétaire</dt>
              <dd className="text-gray-600 ml-4">Import, configuration ou code spécifique à une plateforme</dd>
            </div>
            <div>
              <dt className="font-bold text-gray-800">Package souverain</dt>
              <dd className="text-gray-600 ml-4">Archive contenant tout le nécessaire pour un déploiement autonome</dd>
            </div>
            <div>
              <dt className="font-bold text-gray-800">VPS</dt>
              <dd className="text-gray-600 ml-4">Virtual Private Server - Serveur virtuel dédié</dd>
            </div>
            <div>
              <dt className="font-bold text-gray-800">CI/CD</dt>
              <dd className="text-gray-600 ml-4">Continuous Integration / Continuous Deployment</dd>
            </div>
          </dl>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">7.2 Cas d'usage</h3>
          <div className="space-y-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-bold text-gray-800">Startup SaaS</h4>
              <p className="text-gray-600">Libérer un MVP créé sur Lovable pour le déployer sur infrastructure propre avant la levée de fonds.</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-bold text-gray-800">Agence web</h4>
              <p className="text-gray-600">Créer des prototypes rapides sur Lovable, puis les libérer pour livraison client sur serveurs dédiés.</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-bold text-gray-800">Entreprise</h4>
              <p className="text-gray-600">Migrer des applications internes vers une infrastructure on-premise pour des raisons de compliance.</p>
            </div>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 mb-4">7.3 FAQ</h3>
          <div className="space-y-4">
            <div>
              <p className="font-bold text-gray-800">Q: Combien de temps prend une libération ?</p>
              <p className="text-gray-600">R: En moyenne 2-5 minutes pour un projet standard (50-200 fichiers).</p>
            </div>
            <div>
              <p className="font-bold text-gray-800">Q: Puis-je libérer des projets non-Lovable ?</p>
              <p className="text-gray-600">R: Oui, le Liberator est universel et fonctionne avec n'importe quel projet.</p>
            </div>
            <div>
              <p className="font-bold text-gray-800">Q: Les modifications sont-elles réversibles ?</p>
              <p className="text-gray-600">R: Oui, le projet original n'est jamais modifié. Vous travaillez toujours sur une copie.</p>
            </div>
            <div>
              <p className="font-bold text-gray-800">Q: Comment mettre à jour un projet déjà libéré ?</p>
              <p className="text-gray-600">R: Relancez simplement une libération avec la nouvelle version du projet.</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-gray-200 pt-8 mt-16 text-center text-gray-500">
          <p className="mb-2">Inopay Liberator – Documentation Officielle v2.0.0</p>
          <p>© {new Date().getFullYear()} Inovaq Canada Inc. Tous droits réservés.</p>
          <p className="mt-4 text-sm">
            Contact : support@inopay.dev | Documentation : docs.inopay.dev
          </p>
        </footer>
      </div>
    </div>
  );
};

export default OfficialDocumentation;
