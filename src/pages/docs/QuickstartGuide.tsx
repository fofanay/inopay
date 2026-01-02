import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Printer, ArrowLeft, Check, Lightbulb, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';

const QuickstartGuide = () => {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    setIsExporting(true);
    const element = document.getElementById('doc-content');
    const opt = {
      margin: [15, 15, 15, 15],
      filename: 'Inopay-Liberator-Quickstart-Guide.pdf',
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
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center border-b-2 border-gray-200 pb-12 mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Clock className="w-4 h-4" />
            10 minutes
          </div>
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
            <span className="text-3xl font-bold text-white">⚡</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Quickstart Guide</h1>
          <h2 className="text-2xl text-gray-600 mb-6">Libérez votre projet en 10 minutes</h2>
          <p className="text-lg text-gray-500 max-w-lg">
            Suivez ce guide pas-à-pas pour transformer votre projet Lovable en application 100% souveraine, 
            prête à être déployée sur votre propre serveur.
          </p>
        </div>

        {/* Progress Overview */}
        <div className="bg-gray-50 rounded-xl p-6 mb-12">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Vue d'ensemble</h3>
          <div className="flex items-center justify-between">
            {['Import', 'Config', 'Génération', 'Déploiement', 'Test'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <span className="text-sm text-gray-600 mt-2">{step}</span>
                </div>
                {index < 4 && (
                  <div className="w-12 h-0.5 bg-emerald-300 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1 */}
        <section className="mb-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0">
              1
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Import du projet Lovable</h2>
              <p className="text-gray-500">Temps estimé : 2 minutes</p>
            </div>
          </div>

          <div className="pl-16 space-y-4">
            <p className="text-gray-700">
              Commencez par récupérer votre projet depuis Lovable et l'importer dans Inopay Liberator.
            </p>

            {/* Screenshot placeholder */}
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <div className="text-gray-400 mb-2">📸 Capture d'écran</div>
              <p className="text-sm text-gray-500">Interface d'upload avec zone de drag & drop</p>
              <div className="mt-4 bg-white rounded-lg p-6 shadow-sm inline-block">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <p className="text-gray-400">Glissez votre fichier .zip ici</p>
                  <p className="text-sm text-gray-300 mt-2">ou cliquez pour sélectionner</p>
                </div>
              </div>
            </div>

            <ol className="list-decimal list-inside text-gray-700 space-y-3 ml-4">
              <li>Exportez votre projet depuis Lovable (Menu → Export → Download ZIP)</li>
              <li>Rendez-vous sur <span className="font-mono bg-gray-100 px-2 py-1 rounded">app.inopay.dev/liberator</span></li>
              <li>Cliquez sur "Importer un projet" dans le dashboard</li>
              <li>Glissez-déposez votre fichier .zip dans la zone prévue</li>
              <li>Attendez la validation du format (quelques secondes)</li>
            </ol>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-800">💡 Tip Expert</p>
                  <p className="text-blue-700 text-sm">
                    Vous pouvez aussi connecter directement votre compte GitHub pour importer depuis un repository.
                    Cela permet de synchroniser automatiquement les futures mises à jour.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 2 */}
        <section className="mb-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-yellow-500 text-white rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0">
              2
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configuration de base</h2>
              <p className="text-gray-500">Temps estimé : 2 minutes</p>
            </div>
          </div>

          <div className="pl-16 space-y-4">
            <p className="text-gray-700">
              Une fois le projet importé, configurez les paramètres de libération selon vos besoins.
            </p>

            {/* Screenshot placeholder */}
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <div className="text-gray-400 mb-2">📸 Capture d'écran</div>
              <p className="text-sm text-gray-500">Page de configuration avec options</p>
              <div className="mt-4 bg-white rounded-lg p-6 shadow-sm text-left max-w-md mx-auto">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nom du projet</label>
                    <div className="bg-gray-100 rounded px-3 py-2 text-gray-600">mon-app-liberee</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Runtime détecté</label>
                    <div className="bg-emerald-100 text-emerald-700 rounded px-3 py-2">React + Vite ✓</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-gray-700">Générer Dockerfile</span>
                  </div>
                </div>
              </div>
            </div>

            <ol className="list-decimal list-inside text-gray-700 space-y-3 ml-4">
              <li>Vérifiez que le runtime est correctement détecté (React, Next.js, etc.)</li>
              <li>Activez les options souhaitées :
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li>✅ Générer Dockerfile (recommandé)</li>
                  <li>✅ Nettoyer les patterns IA propriétaires</li>
                  <li>✅ Créer les workflows CI/CD</li>
                </ul>
              </li>
              <li>Cliquez sur "Lancer l'audit"</li>
            </ol>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800">💡 Tip Expert</p>
                  <p className="text-yellow-700 text-sm">
                    Si votre projet utilise des APIs tierces (Stripe, SendGrid...), préparez vos clés API.
                    Elles seront configurées dans le fichier .env généré.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 3 */}
        <section className="mb-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-orange-500 text-white rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0">
              3
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Génération du package</h2>
              <p className="text-gray-500">Temps estimé : 3 minutes</p>
            </div>
          </div>

          <div className="pl-16 space-y-4">
            <p className="text-gray-700">
              Le système analyse votre code, détecte les patterns propriétaires, et génère un package souverain.
            </p>

            {/* Screenshot placeholder */}
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <div className="text-gray-400 mb-2">📸 Capture d'écran</div>
              <p className="text-sm text-gray-500">Progression de la génération</p>
              <div className="mt-4 bg-white rounded-lg p-6 shadow-sm max-w-md mx-auto">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700">Analyse du code source</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700">Nettoyage des patterns</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-white text-xs">...</span>
                    </div>
                    <span className="text-gray-700">Génération du Dockerfile</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-200 rounded-full" />
                    <span className="text-gray-400">Création du package final</span>
                  </div>
                </div>
                <div className="mt-4 bg-gray-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            </div>

            <ol className="list-decimal list-inside text-gray-700 space-y-3 ml-4">
              <li>L'audit détecte automatiquement les patterns propriétaires</li>
              <li>Validez le rapport d'audit (ou modifiez les suggestions)</li>
              <li>Cliquez sur "Générer le package souverain"</li>
              <li>Attendez la fin de la génération (2-3 minutes)</li>
              <li>Téléchargez le fichier <span className="font-mono bg-gray-100 px-2 py-1 rounded">inopay-liberation-package.zip</span></li>
            </ol>

            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-800">💡 Tip Expert</p>
                  <p className="text-orange-700 text-sm">
                    Le package généré inclut un fichier README.md avec toutes les instructions de déploiement 
                    spécifiques à votre projet. Consultez-le avant de continuer !
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 4 */}
        <section className="mb-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-purple-500 text-white rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0">
              4
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Déploiement sur VPS</h2>
              <p className="text-gray-500">Temps estimé : 2 minutes</p>
            </div>
          </div>

          <div className="pl-16 space-y-4">
            <p className="text-gray-700">
              Déployez votre application libérée sur votre propre serveur en quelques commandes.
            </p>

            {/* Screenshot placeholder */}
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <div className="text-gray-400 mb-2">📸 Capture d'écran</div>
              <p className="text-sm text-gray-500">Terminal avec commandes de déploiement</p>
              <div className="mt-4 bg-gray-900 rounded-lg p-4 text-left font-mono text-sm text-green-400">
                <p>$ scp inopay-liberation-package.zip user@server:/app/</p>
                <p className="text-gray-500">inopay-liberation-package.zip     100%  12MB  8.5MB/s</p>
                <p className="mt-2">$ ssh user@server</p>
                <p>$ cd /app && unzip inopay-liberation-package.zip</p>
                <p>$ docker-compose up -d</p>
                <p className="text-emerald-400 mt-2">✓ Container started successfully</p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-100 overflow-x-auto">
              <p className="text-gray-500"># Méthode rapide (une seule commande)</p>
              <p className="text-emerald-400">$ curl -sSL https://inopay.dev/install.sh | sudo bash</p>
              <p className="mt-4 text-gray-500"># Ou manuellement :</p>
              <p className="text-white">$ unzip inopay-liberation-package.zip</p>
              <p className="text-white">$ cd inopay-liberation-package</p>
              <p className="text-white">$ docker-compose up -d</p>
            </div>

            <ol className="list-decimal list-inside text-gray-700 space-y-3 ml-4">
              <li>Connectez-vous à votre VPS via SSH</li>
              <li>Transférez le package ZIP sur le serveur</li>
              <li>Extrayez l'archive : <span className="font-mono bg-gray-100 px-2 py-1 rounded">unzip inopay-liberation-package.zip</span></li>
              <li>Lancez avec Docker : <span className="font-mono bg-gray-100 px-2 py-1 rounded">docker-compose up -d</span></li>
              <li>Configurez votre domaine (optionnel)</li>
            </ol>

            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-purple-800">💡 Tip Expert</p>
                  <p className="text-purple-700 text-sm">
                    Le package inclut une configuration Nginx optimisée avec SSL Let's Encrypt. 
                    Modifiez simplement le fichier .env pour ajouter votre domaine.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Step 5 */}
        <section className="mb-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0">
              5
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Test final</h2>
              <p className="text-gray-500">Temps estimé : 1 minute</p>
            </div>
          </div>

          <div className="pl-16 space-y-4">
            <p className="text-gray-700">
              Vérifiez que votre application fonctionne correctement sur votre infrastructure.
            </p>

            {/* Screenshot placeholder */}
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <div className="text-gray-400 mb-2">📸 Capture d'écran</div>
              <p className="text-sm text-gray-500">Application déployée avec succès</p>
              <div className="mt-4 inline-block">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="bg-gray-200 px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                    </div>
                    <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
                      https://mon-app.example.com
                    </div>
                  </div>
                  <div className="p-8 bg-emerald-50">
                    <div className="text-emerald-500 text-4xl mb-2">✓</div>
                    <p className="text-emerald-700 font-semibold">Application en ligne !</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <h4 className="font-semibold text-gray-800 mb-4">✅ Checklist de validation</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                  <span className="text-gray-700">L'application charge sans erreur</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                  <span className="text-gray-700">La navigation fonctionne</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                  <span className="text-gray-700">Les assets (images, CSS) s'affichent</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                  <span className="text-gray-700">Les appels API fonctionnent</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                  <span className="text-gray-700">Aucune erreur dans la console</span>
                </li>
              </ul>
            </div>

            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-800">💡 Tip Expert</p>
                  <p className="text-emerald-700 text-sm">
                    Utilisez le dashboard de monitoring Inopay pour surveiller les performances 
                    et recevoir des alertes en cas de problème.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Success Banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-8 text-center text-white mb-12">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold mb-2">Félicitations !</h2>
          <p className="text-xl text-emerald-100">
            Votre projet est maintenant 100% souverain et déployé sur votre infrastructure.
          </p>
          <p className="text-emerald-200 mt-4">
            Plus de dépendance, plus de limites. Vous êtes maître de votre code.
          </p>
        </div>

        {/* Next Steps */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🚀 Prochaines étapes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Configurer le CI/CD</h3>
              <p className="text-gray-600 text-sm">Automatisez vos déploiements avec les workflows GitHub/GitLab générés.</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Ajouter un domaine</h3>
              <p className="text-gray-600 text-sm">Configurez votre domaine personnalisé avec SSL automatique.</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Activer le monitoring</h3>
              <p className="text-gray-600 text-sm">Surveillez les performances et la disponibilité de votre app.</p>
            </div>
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Planifier les backups</h3>
              <p className="text-gray-600 text-sm">Configurez les sauvegardes automatiques de votre base de données.</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-gray-200 pt-8 mt-16 text-center text-gray-500">
          <p className="mb-2">Inopay Liberator – Quickstart Guide</p>
          <p>© {new Date().getFullYear()} Inovaq Canada Inc. Tous droits réservés.</p>
          <p className="mt-4 text-sm">
            Besoin d'aide ? support@inopay.dev | docs.inopay.dev
          </p>
        </footer>
      </div>
    </div>
  );
};

export default QuickstartGuide;
