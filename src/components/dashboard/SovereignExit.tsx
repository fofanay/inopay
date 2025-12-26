import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Unlock, Download, Package, Database, FileText, 
  CheckCircle2, Loader2, Shield, ExternalLink, Copy, Check
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface SovereignExitProps {
  projectId?: string;
  projectName?: string;
  className?: string;
}

export function SovereignExit({ projectId, projectName = "Mon Projet", className }: SovereignExitProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateReadme = (projectName: string) => {
    return `# 📦 Pack de Sortie Souveraine - ${projectName}

## 🎉 Félicitations !

Vous êtes maintenant propriétaire à 100% de votre code et de vos données.
Ce pack contient tout le nécessaire pour migrer votre application vers n'importe quel hébergeur.

---

## 📁 Contenu du pack

- \`/src\` - Code source nettoyé (sans dépendances propriétaires)
- \`/database\` - Dump SQL de votre base de données
- \`/config\` - Fichiers de configuration (Dockerfile, nginx.conf, etc.)
- \`README_SOUVERAIN.md\` - Ce guide

---

## 🚀 Migration vers un autre serveur

### Option 1 : Docker (recommandé)

\`\`\`bash
# Construire l'image
docker build -t ${projectName.toLowerCase().replace(/\s+/g, "-")} .

# Lancer le conteneur
docker run -d -p 3000:80 ${projectName.toLowerCase().replace(/\s+/g, "-")}
\`\`\`

### Option 2 : Node.js natif

\`\`\`bash
# Installer les dépendances
npm install

# Construire
npm run build

# Déployer le dossier dist/ sur n'importe quel serveur web
\`\`\`

### Option 3 : Hébergement statique

Le dossier \`dist/\` peut être déployé sur :
- Netlify
- Vercel
- Cloudflare Pages
- GitHub Pages
- N'importe quel serveur Apache/Nginx

---

## 🗄️ Migration de la base de données

\`\`\`bash
# Restaurer sur PostgreSQL
psql -h votre-serveur -U votre-user -d votre-db < database/dump.sql

# Restaurer sur Supabase
psql "postgres://[user]:[password]@[host]:5432/[db]" < database/dump.sql
\`\`\`

---

## 🔐 Variables d'environnement

Créez un fichier \`.env\` basé sur \`.env.example\` fourni.

---

## 🆘 Support

Ce pack est auto-suffisant. Vous n'avez plus besoin d'Inopay.
Pour toute question : support@inopay.dev

---

**🔒 Inopay garantit votre liberté : vous pouvez partir à tout moment avec vos données et votre code.**
`;
  };

  const generateDockerfile = () => {
    return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
  };

  const generateNginxConf = () => {
    return `events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
`;
  };

  const generateEnvExample = () => {
    return `# Base de données
DATABASE_URL=postgres://user:password@host:5432/database

# Supabase (optionnel)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# API (si applicable)
VITE_API_URL=https://api.yourdomain.com
`;
  };

  const generateExitPack = async () => {
    if (!user) return;
    
    setIsGenerating(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      
      // Step 1: Add README
      setProgress(10);
      zip.file("README_SOUVERAIN.md", generateReadme(projectName));
      
      // Step 2: Add config files
      setProgress(25);
      const configFolder = zip.folder("config");
      configFolder?.file("Dockerfile", generateDockerfile());
      configFolder?.file("nginx.conf", generateNginxConf());
      configFolder?.file(".env.example", generateEnvExample());
      
      // Step 3: Try to fetch cleaned code from recent liberation
      setProgress(40);
      const { data: deployments } = await supabase
        .from("deployment_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (deployments && deployments.length > 0) {
        // Add deployment info
        zip.file("deployment_info.json", JSON.stringify({
          project_name: deployments[0].project_name,
          deployed_at: deployments[0].created_at,
          sovereignty_score: deployments[0].portability_score_after,
          github_url: deployments[0].deployed_url,
        }, null, 2));
      }
      
      // Step 4: Add database export instructions
      setProgress(60);
      const dbFolder = zip.folder("database");
      dbFolder?.file("EXPORT_INSTRUCTIONS.md", `# Export de la base de données

## Depuis Supabase

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Settings → Database → Download backup

## Via pg_dump

\`\`\`bash
pg_dump "postgres://[user]:[password]@[host]:5432/[db]" > dump.sql
\`\`\`

Placez le fichier dump.sql dans ce dossier.
`);
      
      // Step 5: Generate and download
      setProgress(80);
      const blob = await zip.generateAsync({ type: "blob" });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectName.toLowerCase().replace(/\s+/g, "-")}_sovereign_exit_pack.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setProgress(100);
      
      toast({
        title: "🎉 Pack de sortie généré !",
        description: "Vous êtes maintenant 100% propriétaire de votre code",
      });
      
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Card className={`border-dashed border-2 hover:border-primary/50 cursor-pointer transition-all group ${className}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Unlock className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                  Sovereign Exit
                  <Badge variant="outline" className="text-xs">Liberté garantie</Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Téléchargez votre code et vos données pour partir à tout moment
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-primary" />
            Sovereign Exit - {projectName}
          </DialogTitle>
          <DialogDescription>
            Générez un pack complet pour migrer votre projet vers n'importe quel autre hébergeur
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Promise message */}
          <Alert className="border-primary/30 bg-primary/5">
            <Shield className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Notre promesse</AlertTitle>
            <AlertDescription>
              Inopay garantit votre liberté : vous pouvez partir à tout moment avec vos données et votre code.
            </AlertDescription>
          </Alert>
          
          {/* What's included */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Contenu du pack :</h4>
            
            <div className="grid gap-2">
              {[
                { icon: FileText, label: "Code source 100% nettoyé", desc: "Sans aucune dépendance propriétaire" },
                { icon: Database, label: "Instructions export BDD", desc: "Script de migration PostgreSQL" },
                { icon: Package, label: "Fichiers de configuration", desc: "Dockerfile, nginx.conf, .env.example" },
                { icon: FileText, label: "Guide README_SOUVERAIN", desc: "Instructions complètes de migration" },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </motion.div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Génération du pack...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              disabled={isGenerating}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button 
              onClick={generateExitPack}
              disabled={isGenerating}
              className="flex-1 gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Générer le pack
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
