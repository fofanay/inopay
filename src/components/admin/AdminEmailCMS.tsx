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
import { Loader2, Plus, Pencil, Trash2, Copy, Eye, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editDialog, setEditDialog] = useState<{ open: boolean; template: EmailTemplate | null }>({ open: false, template: null });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; html: string }>({ open: false, html: "" });
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    html_content: "",
    category: "general",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as EmailTemplate[]);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Erreur lors du chargement des templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openEditDialog = (template?: EmailTemplate) => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject,
        html_content: template.html_content,
        category: template.category,
        is_active: template.is_active,
      });
    } else {
      setFormData({
        name: "",
        subject: "",
        html_content: "",
        category: "general",
        is_active: true,
      });
    }
    setEditDialog({ open: true, template: template || null });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.html_content) {
      toast.error("Tous les champs sont requis");
      return;
    }

    setSaving(true);
    try {
      // Extract variables from content
      const variableRegex = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;
      while ((match = variableRegex.exec(formData.html_content + formData.subject)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      if (editDialog.template) {
        const { error } = await supabase
          .from("email_templates")
          .update({
            ...formData,
            variables,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editDialog.template.id);

        if (error) throw error;
        toast.success("Template mis à jour");
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert({
            ...formData,
            variables,
          });

        if (error) throw error;
        toast.success("Template créé");
      }

      setEditDialog({ open: false, template: null });
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce template ?")) return;

    try {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template supprimé");
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleImportDefaults = async () => {
    setSaving(true);
    try {
      for (const template of defaultTemplates) {
        const { error } = await supabase
          .from("email_templates")
          .insert({
            name: template.name,
            subject: template.subject,
            html_content: template.html_content,
            category: template.category,
            variables: template.variables,
            is_active: true,
          });

        if (error) {
          console.error("Error importing template:", error);
        }
      }
      toast.success("Templates par défaut importés");
      fetchTemplates();
    } catch (error) {
      console.error("Error importing templates:", error);
      toast.error("Erreur lors de l'import");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      fetchTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
    }
  };

  const previewTemplate = (template: EmailTemplate) => {
    const previewHtml = template.html_content
      .replace(/\{\{user_name\}\}/g, "Jean Dupont")
      .replace(/\{\{plan_name\}\}/g, "Pro")
      .replace(/\{\{expiry_date\}\}/g, new Date().toLocaleDateString("fr-FR"))
      .replace(/\{\{days\}\}/g, "7")
      .replace(/\{\{app_url\}\}/g, window.location.origin);

    setPreviewDialog({ open: true, html: previewHtml });
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      onboarding: "bg-green-500/10 text-green-500 border-green-500/20",
      subscription: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      credits: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      general: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return <Badge variant="outline" className={colors[category] || colors.general}>{category}</Badge>;
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Templates d'emails
            </CardTitle>
            <CardDescription>{templates.length} templates configurés</CardDescription>
          </div>
          <div className="flex gap-2">
            {templates.length === 0 && (
              <Button variant="outline" onClick={handleImportDefaults} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importer templates par défaut
              </Button>
            )}
            <Button onClick={() => openEditDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
                  <TableCell>{getCategoryBadge(template.category)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(template.variables as unknown as string[])?.slice(0, 3).map((v: string) => (
                        <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                      ))}
                      {(template.variables as unknown as string[])?.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{(template.variables as unknown as string[]).length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={() => toggleActive(template.id, template.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => previewTemplate(template)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, template: open ? editDialog.template : null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog.template ? "Modifier le template" : "Nouveau template"}</DialogTitle>
            <DialogDescription>
              Utilisez {"{{variable}}"} pour les variables dynamiques
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom du template</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Bienvenue"
                />
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="subscription">Abonnement</SelectItem>
                    <SelectItem value="credits">Crédits</SelectItem>
                    <SelectItem value="reminder">Relance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Sujet de l'email</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ex: Bienvenue sur Inopay, {{user_name}} !"
              />
            </div>
            <div>
              <Label>Contenu HTML</Label>
              <Textarea
                value={formData.html_content}
                onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                placeholder="<html>...</html>"
                rows={15}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Template actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, template: null })}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open, html: open ? previewDialog.html : "" })}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Prévisualisation</DialogTitle>
          </DialogHeader>
          <div 
            className="border rounded-lg p-4 bg-white overflow-auto max-h-[60vh]"
            dangerouslySetInnerHTML={{ __html: previewDialog.html }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailCMS;
