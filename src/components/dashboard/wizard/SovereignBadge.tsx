import { useState, useRef } from "react";
import { Shield, Download, Award, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SovereignBadgeProps {
  score: number;
  projectName: string;
  date?: string;
  className?: string;
}

export function SovereignBadge({ score, projectName, date, className }: SovereignBadgeProps) {
  const { toast } = useToast();
  const badgeRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const isCertified = score >= 90;
  const formattedDate = date || new Date().toLocaleDateString("fr-FR");

  const downloadBadge = async () => {
    setIsDownloading(true);
    
    try {
      // Create SVG for download
      const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2ECC71;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#27AE60;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="400" height="200" rx="12" fill="url(#bgGrad)" />
  
  <!-- Border -->
  <rect x="2" y="2" width="396" height="196" rx="10" fill="none" stroke="url(#borderGrad)" stroke-width="3" />
  
  <!-- Shield icon area -->
  <circle cx="70" cy="100" r="40" fill="#2ECC71" fill-opacity="0.1" />
  <path d="M70 70 L95 80 L95 105 C95 120 70 135 70 135 C70 135 45 120 45 105 L45 80 L70 70Z" fill="#2ECC71" />
  <path d="M63 100 L68 105 L77 92" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  
  <!-- Text content -->
  <text x="130" y="75" font-family="system-ui, sans-serif" font-size="12" fill="#9CA3AF" font-weight="500">CERTIFIÉ SOUVERAIN</text>
  <text x="130" y="105" font-family="system-ui, sans-serif" font-size="20" fill="#FFFFFF" font-weight="bold">${projectName}</text>
  <text x="130" y="130" font-family="system-ui, sans-serif" font-size="14" fill="#2ECC71" font-weight="600">Score: ${score}%</text>
  <text x="130" y="155" font-family="system-ui, sans-serif" font-size="11" fill="#6B7280">${formattedDate}</text>
  
  <!-- Inopay branding -->
  <text x="360" y="180" font-family="system-ui, sans-serif" font-size="10" fill="#6B7280" text-anchor="end">via Inopay</text>
</svg>`;

      const blob = new Blob([svgContent], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `badge-souverain-${projectName.toLowerCase().replace(/\s+/g, "-")}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Badge téléchargé !",
        description: "Partagez-le sur votre README ou site web",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le badge",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isCertified) {
    return (
      <Card className={cn("border-muted bg-muted/30", className)}>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Badge Souverain</p>
              <p className="text-sm text-muted-foreground/70">
                Score minimum requis : 90% (actuel : {score}%)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className="border-success/50 bg-gradient-to-br from-success/10 via-background to-primary/10 overflow-hidden relative">
        {/* Sparkle effects */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Sparkles className="absolute top-4 right-4 h-4 w-4 text-success/50 animate-pulse" />
          <Sparkles className="absolute bottom-6 left-8 h-3 w-3 text-primary/50 animate-pulse" style={{ animationDelay: "0.5s" }} />
        </motion.div>
        
        <CardContent className="flex items-center justify-between p-4" ref={badgeRef}>
          <div className="flex items-center gap-4">
            {/* Shield with checkmark */}
            <motion.div 
              className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center relative"
              animate={{ 
                boxShadow: ["0 0 0 0 hsl(var(--success) / 0.3)", "0 0 0 8px hsl(var(--success) / 0)", "0 0 0 0 hsl(var(--success) / 0.3)"]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Shield className="h-8 w-8 text-success" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center"
              >
                <CheckCircle2 className="h-4 w-4 text-success-foreground" />
              </motion.div>
            </motion.div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
                  <Award className="h-3 w-3" />
                  CERTIFIÉ SOUVERAIN
                </Badge>
              </div>
              <h3 className="font-bold text-lg">{projectName}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-semibold text-success">{score}%</span>
                <span>•</span>
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={downloadBadge}
            disabled={isDownloading}
            className="gap-2 border-success/30 hover:bg-success/10"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
