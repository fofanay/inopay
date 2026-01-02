import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  CheckCircle2,
  FileArchive,
  Shield,
  Server,
  Terminal,
  Copy,
  ExternalLink,
  HardDrive,
  Cpu,
  Clock,
  FileCode,
  Box,
  Zap,
  Github,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PackageSummary {
  projectName: string;
  originalSize: string;
  cleanedSize: string;
  filesTotal: number;
  filesCleaned: number;
  patternsRemoved: number;
  sovereigntyScore: number;
  buildTime: string;
  downloadUrl: string;
}

const mockSummary: PackageSummary = {
  projectName: "my-saas-project",
  originalSize: "24.5 MB",
  cleanedSize: "18.2 MB",
  filesTotal: 156,
  filesCleaned: 24,
  patternsRemoved: 47,
  sovereigntyScore: 100,
  buildTime: "45s",
  downloadUrl: "#",
};

const vpsInstructions = {
  docker: `# 1. Télécharger et extraire le package
unzip my-saas-project-sovereign.zip
cd my-saas-project

# 2. Construire l'image Docker
docker build -t my-saas-project .

# 3. Lancer le conteneur
docker run -d -p 3000:3000 --name my-saas my-saas-project

# 4. Vérifier le statut
docker ps
curl http://localhost:3000`,

  compose: `# 1. Extraire le package
unzip my-saas-project-sovereign.zip
cd my-saas-project

# 2. Lancer avec Docker Compose
docker compose up -d

# 3. Voir les logs
docker compose logs -f

# 4. Arrêter les services
docker compose down`,

  manual: `# 1. Installer les dépendances
npm install

# 2. Construire le frontend
npm run build

# 3. Démarrer le serveur
npm start

# 4. Configurer Nginx/Caddy pour le reverse proxy
# Voir le fichier nginx.conf inclus dans le package`,
};

export default function DownloadPackage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const jobId = searchParams.get("id");
  
  const [summary, setSummary] = useState<PackageSummary>(mockSummary);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownload = async () => {
    setDownloading(true);
    
    // Simulate download progress
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloading(false);
          toast({
            title: "Téléchargement terminé",
            description: "Votre package souverain est prêt!",
          });
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié!",
      description: "Les commandes ont été copiées dans le presse-papier",
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Download className="h-7 w-7 text-primary" />
            Package prêt
          </h1>
          <p className="text-muted-foreground mt-1">
            Votre projet souverain est prêt à être déployé
          </p>
        </div>
        <Badge className="gap-1 bg-primary self-start">
          <Shield className="h-3 w-3" />
          100% Souverain
        </Badge>
      </div>

      {/* Summary Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-background p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shrink-0"
            >
              <FileArchive className="h-10 w-10 text-primary-foreground" />
            </motion.div>
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">{summary.projectName}-sovereign.zip</h2>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HardDrive className="h-4 w-4" />
                  {summary.cleanedSize}
                </span>
                <span className="flex items-center gap-1">
                  <FileCode className="h-4 w-4" />
                  {summary.filesTotal} fichiers
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Build: {summary.buildTime}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-2 shrink-0"
            >
              {downloading ? (
                <>
                  <Download className="h-4 w-4 animate-bounce" />
                  {downloadProgress}%
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Télécharger
                </>
              )}
            </Button>
          </div>
          
          {downloading && (
            <Progress value={downloadProgress} className="h-2 mt-4" />
          )}
        </div>
        
        <CardContent className="py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-primary">{summary.filesCleaned}</div>
              <div className="text-sm text-muted-foreground">Fichiers nettoyés</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-amber-500">{summary.patternsRemoved}</div>
              <div className="text-sm text-muted-foreground">Patterns supprimés</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-emerald-500">{summary.sovereigntyScore}%</div>
              <div className="text-sm text-muted-foreground">Souveraineté</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">-26%</div>
              <div className="text-sm text-muted-foreground">Taille réduite</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VPS Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Instructions de déploiement VPS
          </CardTitle>
          <CardDescription>
            Choisissez votre méthode de déploiement préférée
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="docker">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="docker" className="gap-2">
                <Box className="h-4 w-4" />
                Docker
              </TabsTrigger>
              <TabsTrigger value="compose" className="gap-2">
                <Cpu className="h-4 w-4" />
                Docker Compose
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Terminal className="h-4 w-4" />
                Manuel
              </TabsTrigger>
            </TabsList>
            
            {Object.entries(vpsInstructions).map(([key, commands]) => (
              <TabsContent key={key} value={key}>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => copyToClipboard(commands)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <pre className="p-4 bg-card border rounded-lg overflow-x-auto text-sm">
                    <code>{commands}</code>
                  </pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Package Contents */}
      <Card>
        <CardHeader>
          <CardTitle>Contenu du package</CardTitle>
          <CardDescription>
            Tout ce dont vous avez besoin pour un déploiement autonome
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { name: "Frontend compilé", desc: "React + Vite, prêt pour production", icon: FileCode },
              { name: "Backend portable", desc: "Edge Functions converties", icon: Server },
              { name: "Dockerfile optimisé", desc: "Multi-stage build", icon: Box },
              { name: "docker-compose.yml", desc: "Configuration complète", icon: Cpu },
              { name: "nginx.conf", desc: "Reverse proxy configuré", icon: Shield },
              { name: "deploy.sh", desc: "Script de déploiement auto", icon: Terminal },
              { name: ".env.example", desc: "Variables d'environnement", icon: FileCode },
              { name: "README.md", desc: "Documentation complète", icon: FileCode },
            ].map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
              >
                <item.icon className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <Github className="h-8 w-8 text-foreground mb-3" />
            <h3 className="font-semibold mb-2">Push vers GitHub</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Initialisez un nouveau repo avec votre code souverain
            </p>
            <Button variant="outline" className="w-full gap-2">
              <Github className="h-4 w-4" />
              Créer un repo
              <ExternalLink className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
        
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <Zap className="h-8 w-8 text-amber-500 mb-3" />
            <h3 className="font-semibold mb-2">Libérer un autre projet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Continuez à libérer vos projets du vendor lock-in
            </p>
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/liberator/upload")}>
              <Zap className="h-4 w-4" />
              Nouveau projet
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
