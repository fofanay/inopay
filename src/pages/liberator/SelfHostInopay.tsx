import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Server,
  Download,
  Copy,
  Terminal,
  Shield,
  CheckCircle2,
  Cpu,
  HardDrive,
  Globe,
  Zap,
  ExternalLink,
  FileCode,
  Box,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const requirements = [
  { label: "VPS Linux", description: "Ubuntu 22.04+ ou Debian 12+", icon: Server },
  { label: "2 vCPU minimum", description: "4 vCPU recommandés", icon: Cpu },
  { label: "4 GB RAM minimum", description: "8 GB recommandés", icon: HardDrive },
  { label: "20 GB stockage", description: "SSD recommandé", icon: HardDrive },
  { label: "Docker installé", description: "Version 24.0+", icon: Box },
  { label: "Port 80/443 ouverts", description: "Pour le trafic HTTP(S)", icon: Globe },
];

const installScript = `#!/bin/bash
# Inopay Liberator - Script d'installation automatique

set -e

echo "🚀 Installation d'Inopay Liberator..."

# Vérification Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installation de Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi

# Création du répertoire
mkdir -p /opt/inopay-liberator
cd /opt/inopay-liberator

# Téléchargement de la configuration
curl -fsSL https://get.inopay.dev/liberator/docker-compose.yml -o docker-compose.yml
curl -fsSL https://get.inopay.dev/liberator/.env.example -o .env

# Configuration SSL avec Caddy
docker network create inopay-network 2>/dev/null || true

# Lancement des services
docker compose up -d

echo ""
echo "✅ Installation terminée!"
echo "🌐 Accédez à: http://$(curl -s ifconfig.me):3000"
echo ""
echo "📖 Documentation: https://docs.inopay.dev/liberator"`;

const dockerCompose = `version: '3.8'

services:
  liberator:
    image: inopay/liberator:latest
    container_name: inopay-liberator
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    environment:
      - NODE_ENV=production
      - OLLAMA_URL=http://ollama:11434
    networks:
      - inopay-network

  ollama:
    image: ollama/ollama:latest
    container_name: inopay-ollama
    restart: unless-stopped
    volumes:
      - ollama-data:/root/.ollama
    networks:
      - inopay-network

  caddy:
    image: caddy:alpine
    container_name: inopay-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
    networks:
      - inopay-network

networks:
  inopay-network:
    external: true

volumes:
  ollama-data:
  caddy-data:`;

const manualSteps = [
  { step: 1, title: "Préparer le serveur", command: "apt update && apt upgrade -y" },
  { step: 2, title: "Installer Docker", command: "curl -fsSL https://get.docker.com | sh" },
  { step: 3, title: "Créer le répertoire", command: "mkdir -p /opt/inopay-liberator && cd /opt/inopay-liberator" },
  { step: 4, title: "Télécharger la config", command: "curl -fsSL https://get.inopay.dev/liberator/docker-compose.yml -o docker-compose.yml" },
  { step: 5, title: "Lancer les services", command: "docker compose up -d" },
  { step: 6, title: "Vérifier le statut", command: "docker compose ps" },
];

export default function SelfHostInopay() {
  const { toast } = useToast();
  const [serverDomain, setServerDomain] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié!",
      description: label || "Contenu copié dans le presse-papier",
    });
  };

  const generateScript = () => {
    const script = installScript.replace(
      'http://$(curl -s ifconfig.me):3000',
      serverDomain ? `https://${serverDomain}` : 'http://$(curl -s ifconfig.me):3000'
    );
    setGeneratedScript(script);
    copyToClipboard(script, "Script d'installation généré et copié!");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Server className="h-7 w-7 text-primary" />
          Self-Host Inopay Liberator
        </h1>
        <p className="text-muted-foreground mt-1">
          Installez Inopay Liberator sur votre propre infrastructure
        </p>
      </div>

      {/* Benefits */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">100% Souverain, 100% Gratuit</h2>
              <p className="text-muted-foreground">
                Hébergez Inopay Liberator sur votre VPS pour une souveraineté totale. 
                Open source, sans télémétrie, sans dépendances externes.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 gap-1 bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" />
              Open Source
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Prérequis système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {requirements.map((req, index) => (
              <motion.div
                key={req.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <req.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">{req.label}</div>
                  <div className="text-xs text-muted-foreground">{req.description}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generate Script */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Générer mon script d'installation
          </CardTitle>
          <CardDescription>
            Personnalisez et téléchargez votre script d'installation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Domaine (optionnel)</Label>
            <Input
              placeholder="liberator.mondomaine.com"
              value={serverDomain}
              onChange={(e) => setServerDomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Laissez vide pour utiliser l'IP publique du serveur
            </p>
          </div>
          
          <Button onClick={generateScript} className="w-full gap-2" size="lg">
            <Download className="h-4 w-4" />
            Générer mon script d'auto-hébergement
          </Button>
        </CardContent>
      </Card>

      {/* Installation Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Guide d'installation</CardTitle>
          <CardDescription>
            Choisissez votre méthode d'installation préférée
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auto">
            <TabsList className="w-full justify-start mb-4">
              <TabsTrigger value="auto" className="gap-2">
                <Zap className="h-4 w-4" />
                Automatique
              </TabsTrigger>
              <TabsTrigger value="docker" className="gap-2">
                <Box className="h-4 w-4" />
                Docker Compose
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Terminal className="h-4 w-4" />
                Manuel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="space-y-4">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => copyToClipboard(installScript)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <pre className="p-4 bg-card border rounded-lg overflow-x-auto text-sm max-h-96">
                  <code>{installScript}</code>
                </pre>
              </div>
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm">
                  Exécutez ce script sur votre VPS avec <code className="px-1 py-0.5 bg-muted rounded">bash install.sh</code>
                </p>
              </div>
            </TabsContent>

            <TabsContent value="docker" className="space-y-4">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10"
                  onClick={() => copyToClipboard(dockerCompose)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <pre className="p-4 bg-card border rounded-lg overflow-x-auto text-sm max-h-96">
                  <code>{dockerCompose}</code>
                </pre>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Sauvegardez ce fichier comme <code>docker-compose.yml</code> et lancez avec <code>docker compose up -d</code>
              </div>
            </TabsContent>

            <TabsContent value="manual">
              <div className="space-y-4">
                {manualSteps.map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{item.step}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium mb-2">{item.title}</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-muted rounded text-sm">
                          {item.command}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(item.command)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Post-Installation */}
      <Card>
        <CardHeader>
          <CardTitle>Après l'installation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <Globe className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Accéder à l'interface</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Ouvrez votre navigateur et accédez à votre domaine ou IP
              </p>
              <code className="text-xs bg-muted p-1 rounded">
                http://votre-ip:3000
              </code>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50">
              <Shield className="h-8 w-8 text-amber-500 mb-3" />
              <h3 className="font-semibold mb-1">Configurer SSL</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Caddy configure automatiquement SSL avec Let's Encrypt
              </p>
              <Badge variant="outline">Automatique</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Links */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="outline" className="flex-1 gap-2" asChild>
          <a href="https://docs.inopay.dev/liberator" target="_blank" rel="noopener noreferrer">
            <FileCode className="h-4 w-4" />
            Documentation complète
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
        <Button variant="outline" className="flex-1 gap-2" asChild>
          <a href="https://github.com/inopay/liberator" target="_blank" rel="noopener noreferrer">
            <Box className="h-4 w-4" />
            Code source GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  );
}
