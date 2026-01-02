import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileCheck,
  Box,
  Download,
  History,
  ArrowRight,
  Shield,
  Zap,
  Server,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const stats = [
  { 
    label: "Projets libérés", 
    value: "12", 
    change: "+3 ce mois",
    icon: FileCheck,
    color: "text-primary"
  },
  { 
    label: "Lignes nettoyées", 
    value: "45.2K", 
    change: "+12.5K",
    icon: Zap,
    color: "text-amber-500"
  },
  { 
    label: "Temps économisé", 
    value: "38h", 
    change: "~2 jours",
    icon: Clock,
    color: "text-blue-500"
  },
  { 
    label: "Score souveraineté", 
    value: "98%", 
    change: "+5%",
    icon: Shield,
    color: "text-emerald-500"
  },
];

const recentProjects = [
  { 
    name: "e-commerce-app", 
    status: "completed", 
    score: 100,
    date: "Il y a 2h",
    files: 234
  },
  { 
    name: "saas-dashboard", 
    status: "completed", 
    score: 98,
    date: "Il y a 1 jour",
    files: 189
  },
  { 
    name: "mobile-pwa", 
    status: "in_progress", 
    score: 67,
    date: "En cours",
    files: 156
  },
];

const steps = [
  { 
    number: 1, 
    title: "Upload", 
    description: "Importez votre projet .zip",
    icon: Upload,
    path: "/liberator/upload"
  },
  { 
    number: 2, 
    title: "Audit", 
    description: "Analyse automatique",
    icon: FileCheck,
    path: "/liberator/audit"
  },
  { 
    number: 3, 
    title: "Nettoyage", 
    description: "Suppression des patterns",
    icon: Zap,
    path: "/liberator/cleaner"
  },
  { 
    number: 4, 
    title: "Reconstruction", 
    description: "Package souverain",
    icon: Box,
    path: "/liberator/rebuild"
  },
  { 
    number: 5, 
    title: "Téléchargement", 
    description: "Prêt pour le VPS",
    icon: Download,
    path: "/liberator/download"
  },
];

export default function HomeDashboard() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-background border border-border p-6 md:p-8"
      >
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary">
            Inopay Liberator v2.0
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Libérez vos projets du 
            <span className="text-primary"> vendor lock-in</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mb-6">
            Scannez, nettoyez et transformez vos projets Lovable/Bolt/Cursor en packages 
            100% souverains, prêts à être déployés sur votre infrastructure.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button 
              size="lg" 
              className="gap-2"
              onClick={() => navigate("/liberator/upload")}
            >
              <Upload className="h-4 w-4" />
              Libérer un projet
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="gap-2"
              onClick={() => navigate("/liberator/history")}
            >
              <History className="h-4 w-4" />
              Voir l'historique
            </Button>
          </div>
        </div>
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border hover:border-primary/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  <Badge variant="outline" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {stat.change}
                  </Badge>
                </div>
                <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Pipeline Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Pipeline de libération
          </CardTitle>
          <CardDescription>
            5 étapes pour une souveraineté totale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex-1"
              >
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 flex flex-col items-center gap-2 hover:bg-primary/5 group"
                  onClick={() => navigate(step.path)}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-sm">{step.title}</div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </Button>
                {index < steps.length - 1 && (
                  <div className="hidden md:flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Projects & Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Projets récents</CardTitle>
              <CardDescription>Vos dernières libérations</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/liberator/history")}>
              Voir tout
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentProjects.map((project, index) => (
              <motion.div
                key={project.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                onClick={() => navigate("/liberator/audit")}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    project.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {project.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-muted-foreground">{project.files} fichiers • {project.date}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{project.score}%</div>
                  <Progress value={project.score} className="w-20 h-1.5" />
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>Accès direct aux fonctionnalités</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/liberator/upload")}
            >
              <Upload className="h-6 w-6 text-primary" />
              <span className="text-sm">Nouveau projet</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/liberator/ai-settings")}
            >
              <Server className="h-6 w-6 text-amber-500" />
              <span className="text-sm">Configurer IA</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/liberator/self-host")}
            >
              <Box className="h-6 w-6 text-blue-500" />
              <span className="text-sm">Self-Host</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center gap-2"
              onClick={() => navigate("/liberator/download")}
            >
              <Download className="h-6 w-6 text-emerald-500" />
              <span className="text-sm">Télécharger</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
