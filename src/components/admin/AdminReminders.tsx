import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Play, Pause, Trash2, Send, Bell, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailCampaign {
  id: string;
  template_id: string;
  trigger_type: string;
  trigger_days: number | null;
  status: string;
  last_run: string | null;
  created_at: string;
  email_templates?: {
    name: string;
    subject: string;
  };
}

interface EmailLog {
  id: string;
  user_email: string;
  subject: string;
  sent_at: string;
  status: string;
  opened_at: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
}

const triggerTypes = [
  { value: "subscription_expiring", label: "Abonnement expire bientôt", description: "J-X avant expiration" },
  { value: "low_credits", label: "Crédits faibles", description: "Crédits <= X" },
  { value: "inactive", label: "Utilisateur inactif", description: "Pas de connexion depuis X jours" },
  { value: "welcome", label: "Bienvenue", description: "Nouveau utilisateur" },
];

const AdminReminders = () => {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaignDialog, setCampaignDialog] = useState(false);
  const [testEmailDialog, setTestEmailDialog] = useState<{ open: boolean; campaignId: string | null }>({ open: false, campaignId: null });
  const [testEmail, setTestEmail] = useState("");
  const [formData, setFormData] = useState({
    template_id: "",
    trigger_type: "subscription_expiring",
    trigger_days: "7",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campaignsRes, logsRes, templatesRes] = await Promise.all([
        supabase
          .from("email_campaigns")
          .select("*, email_templates(name, subject)")
          .order("created_at", { ascending: false }),
        supabase
          .from("email_logs")
          .select("*")
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("email_templates")
          .select("id, name, subject")
          .eq("is_active", true),
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (logsRes.error) throw logsRes.error;
      if (templatesRes.error) throw templatesRes.error;

      setCampaigns(campaignsRes.data || []);
      setLogs(logsRes.data || []);
      setTemplates(templatesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCampaign = async () => {
    if (!formData.template_id) {
      toast.error("Sélectionnez un template");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_campaigns")
        .insert({
          template_id: formData.template_id,
          trigger_type: formData.trigger_type,
          trigger_days: formData.trigger_days ? parseInt(formData.trigger_days) : null,
          status: "active",
        });

      if (error) throw error;

      toast.success("Campagne créée");
      setCampaignDialog(false);
      setFormData({ template_id: "", trigger_type: "subscription_expiring", trigger_days: "7" });
      fetchData();
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const toggleCampaignStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("email_campaigns")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      fetchData();
      toast.success(`Campagne ${newStatus === "active" ? "activée" : "pausée"}`);
    } catch (error) {
      console.error("Error toggling campaign:", error);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Supprimer cette campagne ?")) return;

    try {
      const { error } = await supabase
        .from("email_campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Campagne supprimée");
      fetchData();
    } catch (error) {
      console.error("Error deleting campaign:", error);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail || !testEmailDialog.campaignId) {
      toast.error("Email requis");
      return;
    }

    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("send-reminder-emails", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: {
          campaign_id: testEmailDialog.campaignId,
          test_email: testEmail,
        },
      });

      if (error) throw error;

      toast.success("Email de test envoyé");
      setTestEmailDialog({ open: false, campaignId: null });
      setTestEmail("");
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSaving(false);
    }
  };

  const runCampaigns = async () => {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("send-reminder-emails", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error) throw error;

      toast.success(`${data.sent} email(s) envoyé(s)`);
      fetchData();
    } catch (error) {
      console.error("Error running campaigns:", error);
      toast.error("Erreur lors de l'exécution");
    } finally {
      setSaving(false);
    }
  };

  const getTriggerLabel = (type: string) => {
    return triggerTypes.find(t => t.value === type)?.label || type;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("fr-FR");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-primary to-primary/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Campagnes actives</p>
                <p className="text-3xl font-bold text-primary-foreground">
                  {campaigns.filter(c => c.status === "active").length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary-foreground/20">
                <Bell className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-success to-success/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success-foreground/80">Emails envoyés</p>
                <p className="text-3xl font-bold text-success-foreground">{logs.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-success-foreground/20">
                <Send className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md gradient-inopay">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Dernière exécution</p>
                <p className="text-lg font-bold text-white truncate">
                  {campaigns[0]?.last_run ? formatDate(campaigns[0].last_run) : "Jamais"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/20">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns */}
      <Card className="card-hover border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              Campagnes de relance
            </CardTitle>
            <CardDescription className="mt-1">Configurez vos emails automatiques</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runCampaigns} disabled={saving} className="border-border/50 hover:bg-muted">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Exécuter maintenant
            </Button>
            <Button onClick={() => setCampaignDialog(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle campagne
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Template</TableHead>
                  <TableHead className="font-semibold">Déclencheur</TableHead>
                  <TableHead className="font-semibold">Délai</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead className="font-semibold">Dernière exécution</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div>
                        <p className="font-medium">{campaign.email_templates?.name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {campaign.email_templates?.subject}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-accent/10 text-accent border-accent/20">
                        {getTriggerLabel(campaign.trigger_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {campaign.trigger_days !== null ? `J-${campaign.trigger_days}` : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={campaign.status === "active" 
                        ? "bg-success/10 text-success border-success/20" 
                        : "bg-muted text-muted-foreground"
                      }>
                        {campaign.status === "active" ? "Actif" : "Pausé"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {campaign.last_run ? formatDate(campaign.last_run) : "Jamais"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTestEmailDialog({ open: true, campaignId: campaign.id })}
                          className="hover:bg-muted"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCampaignStatus(campaign.id, campaign.status)}
                          className="hover:bg-muted"
                        >
                          {campaign.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCampaign(campaign.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Bell className="h-8 w-8 opacity-50" />
                        <span>Aucune campagne configurée</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="card-hover border-0 shadow-md">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-success/10">
              <Send className="h-5 w-5 text-success" />
            </div>
            Historique des envois
          </CardTitle>
          <CardDescription>50 derniers emails envoyés</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Destinataire</TableHead>
                  <TableHead className="font-semibold">Sujet</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-sm">
                      {formatDate(log.sent_at)}
                    </TableCell>
                    <TableCell className="font-medium">{log.user_email}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                    <TableCell>
                      <Badge className={log.status === "sent" 
                        ? "bg-success/10 text-success border-success/20" 
                        : "bg-destructive/10 text-destructive border-destructive/20"
                      }>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Send className="h-8 w-8 opacity-50" />
                        <span>Aucun email envoyé</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Campaign Dialog */}
      <Dialog open={campaignDialog} onOpenChange={setCampaignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle campagne</DialogTitle>
            <DialogDescription>Configurez une nouvelle campagne de relance automatique</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template d'email</Label>
              <Select value={formData.template_id} onValueChange={(v) => setFormData({ ...formData, template_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Créez d'abord des templates dans le CMS Emails
                </p>
              )}
            </div>
            <div>
              <Label>Déclencheur</Label>
              <Select value={formData.trigger_type} onValueChange={(v) => setFormData({ ...formData, trigger_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div>
                        <div>{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Délai (jours)</Label>
              <Input
                type="number"
                value={formData.trigger_days}
                onChange={(e) => setFormData({ ...formData, trigger_days: e.target.value })}
                placeholder="7"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pour "Abonnement expire bientôt" : J-X avant expiration
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateCampaign} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog open={testEmailDialog.open} onOpenChange={(open) => setTestEmailDialog({ open, campaignId: open ? testEmailDialog.campaignId : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un email de test</DialogTitle>
            <DialogDescription>L'email sera envoyé avec des données de test</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Adresse email</Label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailDialog({ open: false, campaignId: null })}>
              Annuler
            </Button>
            <Button onClick={sendTestEmail} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReminders;
