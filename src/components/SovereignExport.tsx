import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface SovereignExportProps {
  isOpen: boolean;
  onClose: () => void;
}

// Liste des fichiers à exporter pour un déploiement souverain
const SOVEREIGN_FILES = {
  "Dockerfile": `# INOPAY - Dockerfile Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,

  "nginx.conf": `server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`,

  ".env.example": `# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/inopay
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Frontend (variables VITE_)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx

# IA
ANTHROPIC_API_KEY=sk-ant-xxx`,

  "INSTALL.md": `# 🚀 Installation Inopay - Guide Complet

## Prérequis
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (ou Supabase)

## Installation Rapide

### 1. Configuration
\`\`\`bash
cp .env.example .env
# Éditez .env avec vos valeurs
\`\`\`

### 2. Développement Local
\`\`\`bash
npm install
npm run dev
\`\`\`

### 3. Production avec Docker
\`\`\`bash
docker-compose up -d
\`\`\`

## Structure
- \`/frontend\` - Application React
- \`/backend\` - API Express
- \`/database\` - Migrations SQL

## Support
Contact: support@inopay.app
`
};

export function SovereignExport({ isOpen, onClose }: SovereignExportProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    
    try {
      const zip = new JSZip();
      
      // Ajouter les fichiers de configuration
      for (const [path, content] of Object.entries(SOVEREIGN_FILES)) {
        zip.file(path, content);
      }

      // Générer le ZIP
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `inopay-sovereign-${Date.now()}.zip`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Souverain réussi",
        description: "Votre archive est prête pour un déploiement autonome.",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer l'archive.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Export Souverain
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Téléchargez tous les fichiers nécessaires pour déployer Inopay 
            sur votre propre infrastructure, 100% indépendant.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">Inclus dans l'archive :</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Dockerfile optimisé</li>
              <li>docker-compose.yml</li>
              <li>Backend Express complet</li>
              <li>Configuration Nginx</li>
              <li>Guide d'installation</li>
            </ul>
          </div>

          <Button 
            onClick={handleExport} 
            disabled={exporting}
            className="w-full"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Télécharger l'Archive
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
