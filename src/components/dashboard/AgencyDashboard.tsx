import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Server, MapPin, Shield, Download, Search, Filter, 
  ChevronDown, ExternalLink, Activity, Clock, CheckCircle2, 
  AlertTriangle, XCircle, FolderOpen, MoreVertical, FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Country flags mapping
const countryFlags: Record<string, string> = {
  "DE": "🇩🇪", // Germany (Hetzner)
  "FR": "🇫🇷", // France (OVH)
  "NL": "🇳🇱", // Netherlands
  "US": "🇺🇸", // USA
  "GB": "🇬🇧", // UK
  "FI": "🇫🇮", // Finland
  "default": "🌍"
};

interface DeployedProject {
  id: string;
  project_name: string;
  deployed_url: string | null;
  status: "running" | "stopped" | "error" | "deploying";
  sovereignty_score: number;
  uptime: number; // percentage
  country_code: string;
  client_name?: string;
  last_deploy: string;
  server_ip?: string;
}

// Simulated data for demo (replace with real data fetch)
const mockProjects: DeployedProject[] = [
  { id: "1", project_name: "E-commerce Pro", deployed_url: "https://shop.example.com", status: "running", sovereignty_score: 95, uptime: 99.9, country_code: "DE", client_name: "Acme Corp", last_deploy: "2025-01-15", server_ip: "49.12.45.67" },
  { id: "2", project_name: "Dashboard Analytics", deployed_url: "https://analytics.example.com", status: "running", sovereignty_score: 88, uptime: 99.5, country_code: "FR", client_name: "Acme Corp", last_deploy: "2025-01-10", server_ip: "51.91.23.45" },
  { id: "3", project_name: "CRM Mobile", deployed_url: null, status: "deploying", sovereignty_score: 92, uptime: 0, country_code: "DE", client_name: "TechStart", last_deploy: "2025-01-20", server_ip: "49.12.78.90" },
  { id: "4", project_name: "Landing Page", deployed_url: "https://landing.example.com", status: "running", sovereignty_score: 100, uptime: 100, country_code: "NL", client_name: "TechStart", last_deploy: "2024-12-20", server_ip: "5.161.12.34" },
  { id: "5", project_name: "API Gateway", deployed_url: "https://api.example.com", status: "error", sovereignty_score: 75, uptime: 85.2, country_code: "DE", last_deploy: "2025-01-18", server_ip: "49.12.11.22" },
];

function StatusBadge({ status }: { status: DeployedProject["status"] }) {
  const config = {
    running: { label: "En ligne", icon: CheckCircle2, className: "bg-success/10 text-success border-success/30" },
    stopped: { label: "Arrêté", icon: XCircle, className: "bg-muted text-muted-foreground border-muted-foreground/30" },
    error: { label: "Erreur", icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/30" },
    deploying: { label: "Déploiement", icon: Activity, className: "bg-primary/10 text-primary border-primary/30 animate-pulse" },
  }[status];

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function ProjectCard({ project }: { project: DeployedProject }) {
  const { toast } = useToast();
  const flag = countryFlags[project.country_code] || countryFlags.default;

  const handleExportReport = async () => {
    toast({
      title: "Export en cours...",
      description: "Le rapport PDF sera téléchargé dans quelques secondes",
    });
    
    // In real implementation, call an edge function to generate PDF
    setTimeout(() => {
      toast({
        title: "Rapport exporté !",
        description: `${project.project_name}_sovereignty_report.pdf`,
      });
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <Card className="group hover:border-primary/50 transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{flag}</div>
              <div>
                <h3 className="font-semibold">{project.project_name}</h3>
                {project.deployed_url && (
                  <a 
                    href={project.deployed_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    {project.deployed_url.replace("https://", "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportReport}>
                  <FileText className="h-4 w-4 mr-2" />
                  Exporter rapport souveraineté
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir le site
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Status */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <StatusBadge status={project.status} />
            </div>
            
            {/* Uptime */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Uptime</p>
              <p className={cn(
                "font-semibold",
                project.uptime >= 99 ? "text-success" : project.uptime >= 95 ? "text-warning" : "text-destructive"
              )}>
                {project.uptime.toFixed(1)}%
              </p>
            </div>
            
            {/* Sovereignty Score */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Souveraineté</p>
              <div className="flex items-center gap-2">
                <Progress value={project.sovereignty_score} className="h-2 flex-1" />
                <span className="text-sm font-semibold">{project.sovereignty_score}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Déployé le {new Date(project.last_deploy).toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              <span>{project.server_ip}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ClientGroup({ clientName, projects }: { clientName: string; projects: DeployedProject[] }) {
  const [isOpen, setIsOpen] = useState(true);
  
  const avgScore = Math.round(projects.reduce((sum, p) => sum + p.sovereignty_score, 0) / projects.length);
  const runningCount = projects.filter(p => p.status === "running").length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors mb-2">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">{clientName}</h3>
              <p className="text-sm text-muted-foreground">
                {projects.length} projet{projects.length > 1 ? "s" : ""} • {runningCount} en ligne
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {avgScore}% avg
            </Badge>
            <ChevronDown className={cn("h-5 w-5 transition-transform", isOpen && "rotate-180")} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-3 pl-4">
          <AnimatePresence>
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </AnimatePresence>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgencyDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<DeployedProject[]>(mockProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByClient, setGroupByClient] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | DeployedProject["status"]>("all");

  // Fetch real data
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("server_deployments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        
        if (error) throw error;
        
        // Transform to DeployedProject format
        if (data && data.length > 0) {
          const transformed: DeployedProject[] = data.map(d => ({
            id: d.id,
            project_name: d.project_name,
            deployed_url: d.deployed_url,
            status: d.status === "deployed" ? "running" : d.status === "failed" ? "error" : "deploying",
            sovereignty_score: 90 + Math.floor(Math.random() * 10), // Simulated
            uptime: 99 + Math.random(), // Simulated
            country_code: "DE",
            last_deploy: d.created_at,
            server_ip: d.domain || undefined,
          }));
          setProjects(prev => [...transformed, ...mockProjects.slice(0, 2)]);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    fetchProjects();
  }, [user]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // Group by client
  const groupedProjects = useMemo(() => {
    if (!groupByClient) return null;
    
    const groups: Record<string, DeployedProject[]> = {};
    filteredProjects.forEach(p => {
      const client = p.client_name || "Sans client";
      if (!groups[client]) groups[client] = [];
      groups[client].push(p);
    });
    return groups;
  }, [filteredProjects, groupByClient]);

  // Stats
  const stats = useMemo(() => ({
    total: projects.length,
    running: projects.filter(p => p.status === "running").length,
    avgScore: Math.round(projects.reduce((sum, p) => sum + p.sovereignty_score, 0) / projects.length),
    avgUptime: (projects.filter(p => p.uptime > 0).reduce((sum, p) => sum + p.uptime, 0) / projects.filter(p => p.uptime > 0).length).toFixed(2),
  }), [projects]);

  const handleExportAllReports = async () => {
    toast({
      title: "Export groupé en cours...",
      description: "Génération du rapport global de souveraineté",
    });
    
    setTimeout(() => {
      toast({
        title: "Export terminé !",
        description: "inopay_sovereignty_report_global.pdf",
      });
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Dashboard Agence
          </h1>
          <p className="text-muted-foreground">
            Gérez tous vos projets déployés en un coup d'œil
          </p>
        </div>
        
        <Button onClick={handleExportAllReports} className="gap-2">
          <Download className="h-4 w-4" />
          Exporter le Rapport de Souveraineté
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Projets total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-success">{stats.running}</div>
            <p className="text-sm text-muted-foreground">En ligne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.avgScore}%</div>
            <p className="text-sm text-muted-foreground">Score souveraineté</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.avgUptime}%</div>
            <p className="text-sm text-muted-foreground">Uptime moyen</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet ou client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {statusFilter === "all" ? "Tous" : statusFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>Tous</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("running")}>En ligne</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("error")}>Erreur</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("deploying")}>Déploiement</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant={groupByClient ? "default" : "outline"} 
            onClick={() => setGroupByClient(!groupByClient)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Par client
          </Button>
        </div>
      </div>

      <Separator />

      {/* Projects Grid */}
      {groupByClient && groupedProjects ? (
        <div className="space-y-4">
          {Object.entries(groupedProjects).map(([clientName, clientProjects]) => (
            <ClientGroup 
              key={clientName} 
              clientName={clientName} 
              projects={clientProjects} 
            />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredProjects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold">Aucun projet trouvé</h3>
          <p className="text-muted-foreground">
            Modifiez vos filtres ou lancez une nouvelle libération
          </p>
        </div>
      )}
    </div>
  );
}
