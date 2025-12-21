import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Loader2, Plus, Pencil, Trash2, Copy, Eye, Mail, Users, Send, 
  FileText, BarChart3, RefreshCw, Upload, Download, Search, 
  CheckCircle2, XCircle, Clock, MousePointer, AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  variables: unknown[];
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailContact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  source: string;
  tags: string[];
  created_at: string;
}

interface EmailList {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  contact_count?: number;
}

interface EmailSend {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}

interface EmailCampaign {
  id: string;
  name: string | null;
  description: string | null;
  template_id: string | null;
  list_id: string | null;
  status: string | null;
  trigger_type: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  scheduled_at: string | null;
  last_run: string | null;
  created_at: string;
}

const defaultTemplates = [
  {
    name: "Bienvenue",
    subject: "Bienvenue sur Inopay, {{user_name}} !",
    category: "onboarding",
    html_content: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #6366f1;">Bienvenue sur Inopay ! 🎉</h1>
  <p>Bonjour {{user_name}},</p>
  <p>Merci de nous avoir rejoints ! Nous sommes ravis de vous compter parmi nos utilisateurs.</p>
  <p>Avec Inopay, vous pouvez exporter et déployer vos projets Lovable en toute simplicité.</p>
  <a href="{{app_url}}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Commencer maintenant</a>
  <p>À bientôt,<br>L'équipe Inopay</p>
</body>
</html>`,
    variables: ["user_name", "app_url"],
  },
  {
    name: "Abonnement expire bientôt",
    subject: "Votre abonnement Inopay expire dans {{days}} jours",
    category: "subscription",
    html_content: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #f59e0b;">⚠️ Votre abonnement expire bientôt</h1>
  <p>Bonjour {{user_name}},</p>
  <p>Votre abonnement <strong>{{plan_name}}</strong> expire le <strong>{{expiry_date}}</strong>.</p>
  <p>Pour continuer à profiter de toutes les fonctionnalités, pensez à renouveler votre abonnement.</p>
  <a href="{{app_url}}/pricing" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Renouveler maintenant</a>
  <p>Cordialement,<br>L'équipe Inopay</p>
</body>
</html>`,
    variables: ["user_name", "plan_name", "expiry_date", "days", "app_url"],
  },
  {
    name: "Crédits épuisés",
    subject: "Vos crédits Inopay sont épuisés",
    category: "credits",
    html_content: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #ef4444;">Vos crédits sont épuisés 📉</h1>
  <p>Bonjour {{user_name}},</p>
  <p>Vous avez utilisé tous vos crédits d'export ce mois-ci.</p>
  <p>Pour continuer à exporter vos projets, vous pouvez :</p>
  <ul>
    <li>Attendre le renouvellement mensuel</li>
    <li>Acheter un pack de crédits supplémentaires</li>
    <li>Passer à un plan supérieur</li>
  </ul>
  <a href="{{app_url}}/pricing" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Voir les options</a>
  <p>Cordialement,<br>L'équipe Inopay</p>
</body>
</html>`,
    variables: ["user_name", "app_url"],
  },
];

const AdminEmailCMS = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [sends, setSends] = useState<EmailSend[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  
  // Dialog states
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; template: EmailTemplate | null }>({ open: false, template: null });
  const [contactDialog, setContactDialog] = useState<{ open: boolean; contact: EmailContact | null }>({ open: false, contact: null });
  const [listDialog, setListDialog] = useState<{ open: boolean; list: EmailList | null }>({ open: false, list: null });
  const [campaignDialog, setCampaignDialog] = useState<{ open: boolean; campaign: EmailCampaign | null }>({ open: false, campaign: null });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; html: string }>({ open: false, html: "" });
  const [sendTestDialog, setSendTestDialog] = useState<{ open: boolean; templateId: string | null }>({ open: false, templateId: null });
  const [importDialog, setImportDialog] = useState(false);
  
  // Form states
  const [templateForm, setTemplateForm] = useState({ name: "", subject: "", html_content: "", category: "general", is_active: true });
  const [contactForm, setContactForm] = useState({ email: "", first_name: "", last_name: "", status: "active", tags: "" });
  const [listForm, setListForm] = useState({ name: "", description: "", is_active: true });
  const [campaignForm, setCampaignForm] = useState({ name: "", description: "", template_id: "", list_id: "", trigger_type: "manual" });
  const [testEmail, setTestEmail] = useState("");
  const [importData, setImportData] = useState("");
  
  // Search/filter states
  const [searchContacts, setSearchContacts] = useState("");
  const [filterContactStatus, setFilterContactStatus] = useState("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  
  const [saving, setSaving] = useState(false);

  // Fetch all data
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [templatesRes, contactsRes, listsRes, sendsRes, campaignsRes] = await Promise.all([
        supabase.from("email_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("email_contacts").select("*").order("created_at", { ascending: false }),
        supabase.from("email_lists").select("*").order("created_at", { ascending: false }),
        supabase.from("email_sends").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (listsRes.error) throw listsRes.error;
      if (sendsRes.error) throw sendsRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      setTemplates((templatesRes.data || []) as EmailTemplate[]);
      setContacts((contactsRes.data || []) as EmailContact[]);
      setSends((sendsRes.data || []) as EmailSend[]);
      setCampaigns((campaignsRes.data || []) as unknown as EmailCampaign[]);
      
      // Get contact counts for lists
      const listsWithCounts = await Promise.all((listsRes.data || []).map(async (list: EmailList) => {
        const { count } = await supabase
          .from("email_list_contacts")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id);
        return { ...list, contact_count: count || 0 };
      }));
      setLists(listsWithCounts);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Template functions
  const openTemplateDialog = (template?: EmailTemplate) => {
    if (template) {
      setTemplateForm({
        name: template.name,
        subject: template.subject,
        html_content: template.html_content,
        category: template.category,
        is_active: template.is_active,
      });
    } else {
      setTemplateForm({ name: "", subject: "", html_content: "", category: "general", is_active: true });
    }
    setTemplateDialog({ open: true, template: template || null });
  };

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.subject || !templateForm.html_content) {
      toast.error("Tous les champs sont requis");
      return;
    }
    setSaving(true);
    try {
      const variableRegex = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;
      while ((match = variableRegex.exec(templateForm.html_content + templateForm.subject)) !== null) {
        if (!variables.includes(match[1])) variables.push(match[1]);
      }

      if (templateDialog.template) {
        const { error } = await supabase
          .from("email_templates")
          .update({ ...templateForm, variables, updated_at: new Date().toISOString() })
          .eq("id", templateDialog.template.id);
        if (error) throw error;
        toast.success("Template mis à jour");
      } else {
        const { error } = await supabase.from("email_templates").insert({ ...templateForm, variables });
        if (error) throw error;
        toast.success("Template créé");
      }
      setTemplateDialog({ open: false, template: null });
      fetchAll();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Supprimer ce template ?")) return;
    try {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
      toast.success("Template supprimé");
      fetchAll();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const importDefaultTemplates = async () => {
    setSaving(true);
    try {
      for (const template of defaultTemplates) {
        await supabase.from("email_templates").insert({
          name: template.name,
          subject: template.subject,
          html_content: template.html_content,
          category: template.category,
          variables: template.variables,
          is_active: true,
        });
      }
      toast.success("Templates importés");
      fetchAll();
    } catch (error) {
      console.error("Error importing templates:", error);
      toast.error("Erreur lors de l'import");
    } finally {
      setSaving(false);
    }
  };

  const previewTemplate = (template: EmailTemplate) => {
    const previewHtml = template.html_content
      .replace(/\{\{user_name\}\}/g, "Jean Dupont")
      .replace(/\{\{plan_name\}\}/g, "Pro")
      .replace(/\{\{expiry_date\}\}/g, new Date().toLocaleDateString("fr-CA"))
      .replace(/\{\{days\}\}/g, "7")
      .replace(/\{\{app_url\}\}/g, window.location.origin);
    setPreviewDialog({ open: true, html: previewHtml });
  };

  // Contact functions
  const openContactDialog = (contact?: EmailContact) => {
    if (contact) {
      setContactForm({
        email: contact.email,
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        status: contact.status,
        tags: contact.tags?.join(", ") || "",
      });
    } else {
      setContactForm({ email: "", first_name: "", last_name: "", status: "active", tags: "" });
    }
    setContactDialog({ open: true, contact: contact || null });
  };

  const saveContact = async () => {
    if (!contactForm.email) {
      toast.error("L'email est requis");
      return;
    }
    setSaving(true);
    try {
      const tags = contactForm.tags.split(",").map(t => t.trim()).filter(Boolean);
      const data = { 
        email: contactForm.email, 
        first_name: contactForm.first_name || null, 
        last_name: contactForm.last_name || null, 
        status: contactForm.status, 
        tags 
      };

      if (contactDialog.contact) {
        const { error } = await supabase.from("email_contacts").update(data).eq("id", contactDialog.contact.id);
        if (error) throw error;
        toast.success("Contact mis à jour");
      } else {
        const { error } = await supabase.from("email_contacts").insert({ ...data, source: "manual" });
        if (error) throw error;
        toast.success("Contact ajouté");
      }
      setContactDialog({ open: false, contact: null });
      fetchAll();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      if (error.code === "23505") {
        toast.error("Cet email existe déjà");
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Supprimer ce contact ?")) return;
    try {
      const { error } = await supabase.from("email_contacts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Contact supprimé");
      fetchAll();
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const deleteSelectedContacts = async () => {
    if (!confirm(`Supprimer ${selectedContacts.length} contacts ?`)) return;
    try {
      const { error } = await supabase.from("email_contacts").delete().in("id", selectedContacts);
      if (error) throw error;
      toast.success(`${selectedContacts.length} contacts supprimés`);
      setSelectedContacts([]);
      fetchAll();
    } catch (error) {
      console.error("Error deleting contacts:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const importContacts = async () => {
    if (!importData.trim()) {
      toast.error("Veuillez coller des données à importer");
      return;
    }
    setSaving(true);
    try {
      const lines = importData.trim().split("\n");
      let imported = 0;
      for (const line of lines) {
        const [email, first_name, last_name] = line.split(",").map(s => s.trim());
        if (email && email.includes("@")) {
          const { error } = await supabase.from("email_contacts").insert({
            email,
            first_name: first_name || null,
            last_name: last_name || null,
            source: "import",
            status: "active",
          });
          if (!error) imported++;
        }
      }
      toast.success(`${imported} contacts importés`);
      setImportDialog(false);
      setImportData("");
      fetchAll();
    } catch (error) {
      console.error("Error importing contacts:", error);
      toast.error("Erreur lors de l'import");
    } finally {
      setSaving(false);
    }
  };

  const exportContacts = () => {
    const csv = contacts.map(c => `${c.email},${c.first_name || ""},${c.last_name || ""},${c.status}`).join("\n");
    const blob = new Blob([`email,first_name,last_name,status\n${csv}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export téléchargé");
  };

  // List functions
  const openListDialog = (list?: EmailList) => {
    if (list) {
      setListForm({ name: list.name, description: list.description || "", is_active: list.is_active });
    } else {
      setListForm({ name: "", description: "", is_active: true });
    }
    setListDialog({ open: true, list: list || null });
  };

  const saveList = async () => {
    if (!listForm.name) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      if (listDialog.list) {
        const { error } = await supabase.from("email_lists").update(listForm).eq("id", listDialog.list.id);
        if (error) throw error;
        toast.success("Liste mise à jour");
      } else {
        const { error } = await supabase.from("email_lists").insert(listForm);
        if (error) throw error;
        toast.success("Liste créée");
      }
      setListDialog({ open: false, list: null });
      fetchAll();
    } catch (error) {
      console.error("Error saving list:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const deleteList = async (id: string) => {
    if (!confirm("Supprimer cette liste ?")) return;
    try {
      const { error } = await supabase.from("email_lists").delete().eq("id", id);
      if (error) throw error;
      toast.success("Liste supprimée");
      fetchAll();
    } catch (error) {
      console.error("Error deleting list:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const addContactsToList = async (listId: string) => {
    if (selectedContacts.length === 0) {
      toast.error("Sélectionnez des contacts d'abord");
      return;
    }
    try {
      const inserts = selectedContacts.map(contactId => ({ list_id: listId, contact_id: contactId }));
      const { error } = await supabase.from("email_list_contacts").upsert(inserts, { onConflict: "list_id,contact_id" });
      if (error) throw error;
      toast.success(`${selectedContacts.length} contacts ajoutés à la liste`);
      setSelectedContacts([]);
      fetchAll();
    } catch (error) {
      console.error("Error adding to list:", error);
      toast.error("Erreur lors de l'ajout");
    }
  };

  // Campaign functions
  const openCampaignDialog = (campaign?: EmailCampaign) => {
    if (campaign) {
      setCampaignForm({
        name: campaign.name || "",
        description: campaign.description || "",
        template_id: campaign.template_id || "",
        list_id: campaign.list_id || "",
        trigger_type: campaign.trigger_type,
      });
    } else {
      setCampaignForm({ name: "", description: "", template_id: "", list_id: "", trigger_type: "manual" });
    }
    setCampaignDialog({ open: true, campaign: campaign || null });
  };

  const saveCampaign = async () => {
    if (!campaignForm.name) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: campaignForm.name,
        description: campaignForm.description || null,
        template_id: campaignForm.template_id || null,
        list_id: campaignForm.list_id || null,
        trigger_type: campaignForm.trigger_type,
      };

      if (campaignDialog.campaign) {
        const { error } = await supabase.from("email_campaigns").update(data).eq("id", campaignDialog.campaign.id);
        if (error) throw error;
        toast.success("Campagne mise à jour");
      } else {
        const { error } = await supabase.from("email_campaigns").insert({ ...data, status: "draft" });
        if (error) throw error;
        toast.success("Campagne créée");
      }
      setCampaignDialog({ open: false, campaign: null });
      fetchAll();
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Supprimer cette campagne ?")) return;
    try {
      const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
      toast.success("Campagne supprimée");
      fetchAll();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Send test email
  const sendTestEmailFn = async () => {
    if (!testEmail || !sendTestDialog.templateId) {
      toast.error("Email requis");
      return;
    }
    setSaving(true);
    try {
      const template = templates.find(t => t.id === sendTestDialog.templateId);
      if (!template) throw new Error("Template not found");

      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: testEmail,
          subject: template.subject.replace(/\{\{user_name\}\}/g, "Test User"),
          html: template.html_content
            .replace(/\{\{user_name\}\}/g, "Test User")
            .replace(/\{\{app_url\}\}/g, window.location.origin),
        },
      });

      if (error) throw error;

      // Log the send
      await supabase.from("email_sends").insert({
        template_id: template.id,
        recipient_email: testEmail,
        subject: template.subject,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      toast.success("Email de test envoyé");
      setSendTestDialog({ open: false, templateId: null });
      setTestEmail("");
      fetchAll();
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSaving(false);
    }
  };

  // Utility functions
  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
      active: { variant: "default", icon: CheckCircle2 },
      sent: { variant: "default", icon: CheckCircle2 },
      delivered: { variant: "default", icon: CheckCircle2 },
      opened: { variant: "secondary", icon: Eye },
      clicked: { variant: "secondary", icon: MousePointer },
      unsubscribed: { variant: "outline", icon: XCircle },
      bounced: { variant: "destructive", icon: AlertCircle },
      failed: { variant: "destructive", icon: XCircle },
      pending: { variant: "outline", icon: Clock },
    };
    const cfg = config[status] || { variant: "outline" as const, icon: Clock };
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      onboarding: "bg-success/10 text-success border-success/20",
      subscription: "bg-primary/10 text-primary border-primary/20",
      credits: "bg-warning/10 text-warning border-warning/20",
      general: "bg-muted text-muted-foreground border-border",
    };
    return <Badge variant="outline" className={colors[category] || colors.general}>{category}</Badge>;
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = !searchContacts || 
      c.email.toLowerCase().includes(searchContacts.toLowerCase()) ||
      c.first_name?.toLowerCase().includes(searchContacts.toLowerCase()) ||
      c.last_name?.toLowerCase().includes(searchContacts.toLowerCase());
    const matchesStatus = filterContactStatus === "all" || c.status === filterContactStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    totalContacts: contacts.length,
    activeContacts: contacts.filter(c => c.status === "active").length,
    totalSends: sends.length,
    openRate: sends.length > 0 ? Math.round((sends.filter(s => s.opened_at).length / sends.length) * 100) : 0,
    clickRate: sends.length > 0 ? Math.round((sends.filter(s => s.clicked_at).length / sends.length) * 100) : 0,
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 bg-muted/50">
          <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2"><Users className="h-4 w-4" />Contacts</TabsTrigger>
          <TabsTrigger value="lists" className="gap-2"><Copy className="h-4 w-4" />Listes</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2"><Mail className="h-4 w-4" />Campagnes</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><Send className="h-4 w-4" />Historique</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-primary to-primary/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-foreground/80">Contacts</p>
                    <p className="text-3xl font-bold text-primary-foreground">{stats.totalContacts}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary-foreground/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-success to-success/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-success-foreground/80">Actifs</p>
                    <p className="text-3xl font-bold text-success-foreground">{stats.activeContacts}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-success-foreground/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-accent to-accent/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-accent-foreground/80">Emails envoyés</p>
                    <p className="text-3xl font-bold text-accent-foreground">{stats.totalSends}</p>
                  </div>
                  <Send className="h-8 w-8 text-accent-foreground/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover border-0 shadow-md gradient-inopay">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/80">Taux d'ouverture</p>
                    <p className="text-3xl font-bold text-white">{stats.openRate}%</p>
                  </div>
                  <Eye className="h-8 w-8 text-white/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-warning to-warning/80">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-warning-foreground/80">Taux de clics</p>
                    <p className="text-3xl font-bold text-warning-foreground">{stats.clickRate}%</p>
                  </div>
                  <MousePointer className="h-8 w-8 text-warning-foreground/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="border-b border-border/50 bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Templates récents
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {templates.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.subject}</p>
                    </div>
                    {getCategoryBadge(t.category)}
                  </div>
                ))}
                {templates.length === 0 && <p className="text-muted-foreground text-center py-4">Aucun template</p>}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="border-b border-border/50 bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Derniers envois
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {sends.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{s.recipient_email}</p>
                      <p className="text-sm text-muted-foreground">{s.subject}</p>
                    </div>
                    {getStatusBadge(s.status)}
                  </div>
                ))}
                {sends.length === 0 && <p className="text-muted-foreground text-center py-4">Aucun envoi</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Templates d'emails
                </CardTitle>
                <CardDescription>{templates.length} templates</CardDescription>
              </div>
              <div className="flex gap-2">
                {templates.length === 0 && (
                  <Button variant="outline" onClick={importDefaultTemplates} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Importer par défaut
                  </Button>
                )}
                <Button onClick={() => openTemplateDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Nom</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
                      <TableCell>{getCategoryBadge(template.category)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(template.variables as string[])?.slice(0, 2).map(v => (
                            <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                          ))}
                          {(template.variables as string[])?.length > 2 && (
                            <Badge variant="secondary" className="text-xs">+{(template.variables as string[]).length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={template.is_active} onCheckedChange={async () => {
                          await supabase.from("email_templates").update({ is_active: !template.is_active }).eq("id", template.id);
                          fetchAll();
                        }} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => previewTemplate(template)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSendTestDialog({ open: true, templateId: template.id }); }}><Send className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openTemplateDialog(template)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteTemplate(template.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Contacts
                </CardTitle>
                <CardDescription>{contacts.length} contacts</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialog(true)}><Upload className="h-4 w-4 mr-2" />Importer</Button>
                <Button variant="outline" onClick={exportContacts}><Download className="h-4 w-4 mr-2" />Exporter</Button>
                <Button onClick={() => openContactDialog()}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher..." 
                    value={searchContacts} 
                    onChange={e => setSearchContacts(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterContactStatus} onValueChange={setFilterContactStatus}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actifs</SelectItem>
                    <SelectItem value="unsubscribed">Désabonnés</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                  </SelectContent>
                </Select>
                {selectedContacts.length > 0 && (
                  <>
                    <Select onValueChange={addContactsToList}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="Ajouter à une liste..." /></SelectTrigger>
                      <SelectContent>
                        {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="destructive" size="sm" onClick={deleteSelectedContacts}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer ({selectedContacts.length})
                    </Button>
                  </>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                        onCheckedChange={(checked) => {
                          setSelectedContacts(checked ? filteredContacts.map(c => c.id) : []);
                        }}
                      />
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map(contact => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={(checked) => {
                            setSelectedContacts(prev => checked ? [...prev, contact.id] : prev.filter(id => id !== contact.id));
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{contact.email}</TableCell>
                      <TableCell>{contact.first_name} {contact.last_name}</TableCell>
                      <TableCell>{getStatusBadge(contact.status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags?.slice(0, 2).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{contact.source}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openContactDialog(contact)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteContact(contact.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lists Tab */}
        <TabsContent value="lists">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Copy className="h-5 w-5 text-primary" />
                  Listes de diffusion
                </CardTitle>
                <CardDescription>{lists.length} listes</CardDescription>
              </div>
              <Button onClick={() => openListDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle liste
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Nom</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lists.map(list => (
                    <TableRow key={list.id}>
                      <TableCell className="font-medium">{list.name}</TableCell>
                      <TableCell className="text-muted-foreground">{list.description || "-"}</TableCell>
                      <TableCell><Badge variant="secondary">{list.contact_count} contacts</Badge></TableCell>
                      <TableCell>
                        <Switch checked={list.is_active} onCheckedChange={async () => {
                          await supabase.from("email_lists").update({ is_active: !list.is_active }).eq("id", list.id);
                          fetchAll();
                        }} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openListDialog(list)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteList(list.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Campagnes
                </CardTitle>
                <CardDescription>{campaigns.length} campagnes</CardDescription>
              </div>
              <Button onClick={() => openCampaignDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle campagne
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Envoyés</TableHead>
                    <TableHead>Ouverts</TableHead>
                    <TableHead>Cliqués</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map(campaign => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name || "Sans nom"}</TableCell>
                      <TableCell><Badge variant="outline">{campaign.trigger_type}</Badge></TableCell>
                      <TableCell>{campaign.sent_count}</TableCell>
                      <TableCell>{campaign.opened_count}</TableCell>
                      <TableCell>{campaign.clicked_count}</TableCell>
                      <TableCell>{getStatusBadge(campaign.status || "draft")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openCampaignDialog(campaign)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCampaign(campaign.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Historique des envois
                </CardTitle>
                <CardDescription>{sends.length} emails envoyés</CardDescription>
              </div>
              <Button variant="outline" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2" />Actualiser</Button>
            </CardHeader>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Date</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Ouvert</TableHead>
                    <TableHead>Cliqué</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.map(send => (
                    <TableRow key={send.id}>
                      <TableCell className="font-mono text-sm">
                        {send.sent_at ? new Date(send.sent_at).toLocaleString("fr-CA") : "-"}
                      </TableCell>
                      <TableCell>{send.recipient_email}</TableCell>
                      <TableCell className="max-w-xs truncate">{send.subject}</TableCell>
                      <TableCell>{getStatusBadge(send.status)}</TableCell>
                      <TableCell>
                        {send.opened_at ? (
                          <Badge variant="secondary" className="gap-1">
                            <Eye className="h-3 w-3" />
                            {new Date(send.opened_at).toLocaleString("fr-CA")}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {send.clicked_at ? (
                          <Badge variant="secondary" className="gap-1">
                            <MousePointer className="h-3 w-3" />
                            {new Date(send.clicked_at).toLocaleString("fr-CA")}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={templateDialog.open} onOpenChange={(open) => setTemplateDialog({ open, template: null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{templateDialog.template ? "Modifier le template" : "Nouveau template"}</DialogTitle>
            <DialogDescription>Utilisez {"{{variable}}"} pour les variables dynamiques</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <Input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Ex: Bienvenue" />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={templateForm.category} onValueChange={v => setTemplateForm({ ...templateForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="subscription">Abonnement</SelectItem>
                    <SelectItem value="credits">Crédits</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="transactional">Transactionnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Sujet</Label>
              <Input value={templateForm.subject} onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="Sujet de l'email" />
            </div>
            <div>
              <Label>Contenu HTML</Label>
              <Textarea value={templateForm.html_content} onChange={e => setTemplateForm({ ...templateForm, html_content: e.target.value })} placeholder="<html>...</html>" rows={15} className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={templateForm.is_active} onCheckedChange={v => setTemplateForm({ ...templateForm, is_active: v })} />
              <Label>Template actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog({ open: false, template: null })}>Annuler</Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialog.open} onOpenChange={(open) => setContactDialog({ open, contact: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contactDialog.contact ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} type="email" placeholder="email@exemple.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prénom</Label>
                <Input value={contactForm.first_name} onChange={e => setContactForm({ ...contactForm, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={contactForm.last_name} onChange={e => setContactForm({ ...contactForm, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={contactForm.status} onValueChange={v => setContactForm({ ...contactForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="unsubscribed">Désabonné</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="complained">Plainte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags (séparés par virgule)</Label>
              <Input value={contactForm.tags} onChange={e => setContactForm({ ...contactForm, tags: e.target.value })} placeholder="client, vip, newsletter" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialog({ open: false, contact: null })}>Annuler</Button>
            <Button onClick={saveContact} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List Dialog */}
      <Dialog open={listDialog.open} onOpenChange={(open) => setListDialog({ open, list: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{listDialog.list ? "Modifier la liste" : "Nouvelle liste"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={listForm.name} onChange={e => setListForm({ ...listForm, name: e.target.value })} placeholder="Ex: Newsletter" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={listForm.description} onChange={e => setListForm({ ...listForm, description: e.target.value })} placeholder="Description de la liste..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={listForm.is_active} onCheckedChange={v => setListForm({ ...listForm, is_active: v })} />
              <Label>Liste active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialog({ open: false, list: null })}>Annuler</Button>
            <Button onClick={saveList} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Dialog */}
      <Dialog open={campaignDialog.open} onOpenChange={(open) => setCampaignDialog({ open, campaign: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{campaignDialog.campaign ? "Modifier la campagne" : "Nouvelle campagne"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input value={campaignForm.name} onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })} placeholder="Ex: Campagne de bienvenue" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={campaignForm.description} onChange={e => setCampaignForm({ ...campaignForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Template</Label>
              <Select value={campaignForm.template_id} onValueChange={v => setCampaignForm({ ...campaignForm, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un template..." /></SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.is_active).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Liste de diffusion</Label>
              <Select value={campaignForm.list_id} onValueChange={v => setCampaignForm({ ...campaignForm, list_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une liste..." /></SelectTrigger>
                <SelectContent>
                  {lists.filter(l => l.is_active).map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.contact_count})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de déclenchement</Label>
              <Select value={campaignForm.trigger_type} onValueChange={v => setCampaignForm({ ...campaignForm, trigger_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuel</SelectItem>
                  <SelectItem value="signup">Inscription</SelectItem>
                  <SelectItem value="expiry_reminder">Rappel expiration</SelectItem>
                  <SelectItem value="credits_low">Crédits bas</SelectItem>
                  <SelectItem value="scheduled">Planifié</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialog({ open: false, campaign: null })}>Annuler</Button>
            <Button onClick={saveCampaign} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open, html: "" })}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Aperçu du template</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-auto max-h-[70vh] bg-white">
            <iframe srcDoc={previewDialog.html} className="w-full h-[500px] border-0" title="Preview" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Test Dialog */}
      <Dialog open={sendTestDialog.open} onOpenChange={(open) => setSendTestDialog({ open, templateId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un email de test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Adresse email</Label>
              <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} type="email" placeholder="votre@email.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTestDialog({ open: false, templateId: null })}>Annuler</Button>
            <Button onClick={sendTestEmailFn} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer des contacts</DialogTitle>
            <DialogDescription>Format: email, prénom, nom (un contact par ligne)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea 
              value={importData} 
              onChange={e => setImportData(e.target.value)} 
              placeholder="john@example.com, John, Doe&#10;jane@example.com, Jane, Smith"
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>Annuler</Button>
            <Button onClick={importContacts} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailCMS;