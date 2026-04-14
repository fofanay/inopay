import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Loader2, Shield, AlertTriangle, CheckCircle, XCircle, FileText, Clock, Send, MessageSquare, Globe, ListChecks, BadgeCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const API_URL = import.meta.env.VITE_API_URL || 'https://api.getinopay.com';
const DOWNLOAD_URL = `${API_URL}/upload/download`;
const marketLabels: Record<string, string> = { BRVM: "🇨🇮 BRVM", BVMAC: "🇨🇲 BVMAC", GSE: "🇬🇭 GSE" };

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nom complet", date_of_birth: "Date de naissance", nationality: "Nationalité",
  phone: "Téléphone", address: "Adresse", country_of_residence: "Pays de résidence",
  id_type: "Type de pièce", id_number: "N° document", id_document_url: "Scan pièce d'identité",
  selfie_url: "Selfie", proof_of_residence_url: "Justificatif de domicile",
  profession: "Profession", source_of_funds: "Source des revenus", employer: "Employeur",
  tax_id: "N° fiscal", annual_income_range: "Tranche de revenu",
  investment_experience: "Expérience", investment_objectives: "Objectifs",
};

interface Props {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string | null;
  onKycUpdated?: () => void;
}

const kycStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode }> = {
  VALIDE: { label: "Validé", variant: "default", icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> },
  EN_ATTENTE: { label: "En attente", variant: "secondary", icon: <Clock className="h-4 w-4 text-amber-500" /> },
  SOUMIS: { label: "Soumis", variant: "secondary", icon: <Send className="h-4 w-4 text-blue-500" /> },
  REFUSE: { label: "Refusé", variant: "destructive", icon: <XCircle className="h-4 w-4 text-destructive" /> },
  NON_COMMENCE: { label: "Non commencé", variant: "outline", icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
};

export const SgiKycDialog: React.FC<Props> = ({ userId, userName, open, onOpenChange, tenantId, onKycUpdated }) => {
  const [kyc, setKyc] = useState<any>(null);
  const [pepScreening, setPepScreening] = useState<any>(null);
  const [docRequests, setDocRequests] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentField, setCommentField] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [sgiReqs, setSgiReqs] = useState<any>(null);
  const [sgiCompletion, setSgiCompletion] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: kycs } = await supabase.from("kycs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
    const kycData = kycs?.[0] || null;
    setKyc(kycData);

    if (kycData) {
      const [pepRes, docsRes, commentsRes] = await Promise.all([
        supabase.from("kyc_pep_screening").select("*").eq("kyc_id", kycData.id).order("screened_at", { ascending: false }).limit(1),
        supabase.from("kyc_document_requests").select("*").eq("kyc_id", kycData.id).order("created_at", { ascending: false }),
        supabase.from("kyc_review_comments").select("*").eq("kyc_id", kycData.id).order("created_at", { ascending: true }),
      ]);
      setPepScreening(pepRes.data?.[0] || null);
      setDocRequests(docsRes.data || []);
      setComments(commentsRes.data || []);

      // Load SGI requirements and completion for this tenant
      if (tenantId) {
        const [reqRes, compRes] = await Promise.all([
          supabase.from("sgi_kyc_requirements" as any).select("*").eq("tenant_id", tenantId).maybeSingle(),
          supabase.from("sgi_kyc_completions" as any).select("*").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle(),
        ]);
        setSgiReqs(reqRes.data);
        setSgiCompletion(compRes.data);
      }
    }
    setLoading(false);
  };

  useEffect(() => { if (open) fetchData(); }, [open, userId]);

  const handleDownload = async (path: string) => {
    setDownloading(path);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const resp = await fetch(`${DOWNLOAD_URL}&path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!resp.ok) throw new Error("Erreur de téléchargement");
      const blob = await resp.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setDownloading(null); }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!kyc) return;
    setUpdating(true);
    try {
      const updatePayload: any = { status: newStatus, reviewed_at: new Date().toISOString() };
      if (newStatus === "VALIDE") {
        updatePayload.base_kyc_verified_at = new Date().toISOString();
      }
      const { error } = await supabase.from("kycs").update(updatePayload).eq("id", kyc.id);
      if (error) throw error;
      setKyc({ ...kyc, ...updatePayload });
      toast({ title: "Statut mis à jour", description: `KYC marqué comme ${kycStatusConfig[newStatus]?.label || newStatus}.` });
      onKycUpdated?.();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setUpdating(false); }
  };

  const handleCompletionStatusUpdate = async (newStatus: string) => {
    if (!sgiCompletion) return;
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("sgi_kyc_completions" as any)
        .update({
          status: newStatus,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", (sgiCompletion as any).id);
      if (error) throw error;
      setSgiCompletion({ ...sgiCompletion, status: newStatus });
      toast({ title: "Complément mis à jour", description: `Complément SGI marqué comme ${newStatus}.` });
      onKycUpdated?.();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setUpdating(false); }
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !kyc) return;
    setSendingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("kyc_review_comments").insert({
        kyc_id: kyc.id, author_id: user.id, author_role: "sgi", comment: newComment.trim(), field_name: commentField || null,
      } as any);
      if (error) throw error;
      setComments((prev) => [...prev, { author_role: "sgi", comment: newComment.trim(), field_name: commentField || null, created_at: new Date().toISOString() }]);
      setNewComment("");
      setCommentField("");
      toast({ title: "Commentaire envoyé" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setSendingComment(false); }
  };

  const statusCfg = kycStatusConfig[kyc?.status] || kycStatusConfig.NON_COMMENCE;
  const isBaseVerified = kyc?.status === "VALIDE" || !!kyc?.base_kyc_verified_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            KYC — {userName}
            {kyc?.target_market && <Badge variant="outline" className="text-xs">{marketLabels[kyc.target_market] || kyc.target_market}</Badge>}
          </DialogTitle>
          <DialogDescription>Consultation et gestion du dossier KYC</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !kyc ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun dossier KYC soumis par ce client.</p>
        ) : (
          <>
            {/* Dual status badges */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                {isBaseVerified ? <BadgeCheck className="h-3.5 w-3.5 text-primary" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="font-medium">Base Inopay:</span>
                <span>{isBaseVerified ? "Vérifié ✓" : statusCfg.label}</span>
              </div>
              {sgiCompletion && (
                <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                  {(sgiCompletion as any).status === "approved" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                  <span className="font-medium">Complément SGI:</span>
                  <span>{(sgiCompletion as any).status === "approved" ? "Approuvé ✓" : (sgiCompletion as any).status === "rejected" ? "Refusé" : "En attente"}</span>
                </div>
              )}
              {!sgiCompletion && sgiReqs && (
                <div className="flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Complément SGI: Non soumis</span>
                </div>
              )}
            </div>

            <Tabs defaultValue="info" className="mt-2">
              <TabsList className="w-full flex-wrap">
                <TabsTrigger value="info" className="flex-1">Identité</TabsTrigger>
                <TabsTrigger value="financial" className="flex-1">Financier</TabsTrigger>
                <TabsTrigger value="docs" className="flex-1">Documents</TabsTrigger>
                {sgiCompletion && <TabsTrigger value="complement" className="flex-1">Complément</TabsTrigger>}
                <TabsTrigger value="screening" className="flex-1">Screening</TabsTrigger>
                <TabsTrigger value="comments" className="flex-1">Échanges ({comments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">{statusCfg.icon}<span className="font-medium text-sm">Statut KYC de base</span></div>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Nom complet", kyc.full_name],
                    ["Date de naissance", kyc.date_of_birth],
                    ["Nationalité", kyc.nationality],
                    ["Pays de résidence", kyc.country_of_residence],
                    ["Téléphone", kyc.phone],
                    ["Type de pièce", kyc.id_type],
                    ["N° document", kyc.id_number],
                    ["Expiration pièce", kyc.id_expiry_date],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{label}</p>
                      <p className="font-medium">{val || "—"}</p>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Adresse</p>
                    <p className="font-medium">{kyc.address || "—"}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Actions — KYC de base</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusUpdate("VALIDE")} disabled={updating || kyc.status === "VALIDE"}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Valider
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate("REFUSE")} disabled={updating || kyc.status === "REFUSE"}>
                      <XCircle className="h-4 w-4 mr-1" /> Refuser
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("EN_ATTENTE")} disabled={updating || kyc.status === "EN_ATTENTE"}>
                      <Clock className="h-4 w-4 mr-1" /> Mettre en attente
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financial" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ["Profession", kyc.profession],
                    ["Employeur", kyc.employer],
                    ["Source des revenus", kyc.source_of_funds],
                    ["N° fiscal", kyc.tax_id],
                    ["Niveau de risque", kyc.risk_level],
                    ["Marché cible", kyc.target_market],
                    ["US Person (FATCA)", kyc.is_us_person ? "⚠️ Oui" : "Non"],
                    ["PEP auto-déclaré", kyc.political_exposure_self ? "⚠️ Oui" : "Non"],
                    ["Due diligence", kyc.due_diligence_level || "—"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">{label}</p>
                      <p className="font-medium">{val || "—"}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="docs" className="space-y-3 mt-4">
                <p className="text-sm font-semibold">Documents KYC (chiffrés)</p>
                {[
                  { label: "Pièce d'identité", path: kyc.id_document_url, icon: "🪪" },
                  { label: "Selfie de vérification", path: kyc.selfie_url, icon: "🤳" },
                  { label: "Justificatif de résidence", path: kyc.proof_of_residence_url, icon: "🏠" },
                ].map((doc) => (
                  <div key={doc.label} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{doc.icon}</span>
                      <div>
                        <span className="text-sm font-medium">{doc.label}</span>
                        <p className="text-xs text-muted-foreground">{doc.path ? "Document fourni" : "Non fourni"}</p>
                      </div>
                    </div>
                    {doc.path ? (
                      <Button variant="outline" size="sm" onClick={() => handleDownload(doc.path!)} disabled={downloading === doc.path}>
                        {downloading === doc.path ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}Consulter
                      </Button>
                    ) : <Badge variant="outline" className="text-xs">Manquant</Badge>}
                  </div>
                ))}

                {docRequests.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-sm font-semibold">Documents complémentaires demandés</p>
                    {docRequests.map((req) => (
                      <div key={req.id} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium capitalize">{req.document_type?.replace(/_/g, " ")}</span>
                          </div>
                          <Badge variant={req.status === "submitted" ? "default" : "outline"}>{req.status === "submitted" ? "Soumis" : "En attente"}</Badge>
                        </div>
                        {req.reason && <p className="text-xs text-muted-foreground">Motif : {req.reason}</p>}
                        {req.document_url && req.status === "submitted" && (
                          <Button variant="outline" size="sm" className="mt-1" onClick={() => handleDownload(req.document_url)}>
                            <Download className="h-3 w-3 mr-1" /> Voir
                          </Button>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>

              {/* SGI Completion Tab */}
              {sgiCompletion && (
                <TabsContent value="complement" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium">Statut du complément SGI</span>
                    <Badge variant={(sgiCompletion as any).status === "approved" ? "default" : (sgiCompletion as any).status === "rejected" ? "destructive" : "secondary"}>
                      {(sgiCompletion as any).status === "approved" ? "Approuvé" : (sgiCompletion as any).status === "rejected" ? "Refusé" : "En attente"}
                    </Badge>
                  </div>

                  {/* Extra data */}
                  {(sgiCompletion as any).extra_data && Object.keys((sgiCompletion as any).extra_data).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Données complémentaires</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {Object.entries((sgiCompletion as any).extra_data).map(([key, val]) => (
                          <div key={key}>
                            <p className="text-muted-foreground text-xs uppercase mb-1">{FIELD_LABELS[key] || key}</p>
                            <p className="font-medium">{String(val) || "—"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extra documents */}
                  {(sgiCompletion as any).extra_documents && ((sgiCompletion as any).extra_documents as any[]).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Documents complémentaires</p>
                      {((sgiCompletion as any).extra_documents as any[]).map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{doc.name}</span>
                          </div>
                          {doc.url && (
                            <Button variant="outline" size="sm" onClick={() => handleDownload(doc.url)}>
                              <Download className="h-3 w-3 mr-1" /> Voir
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Actions — Complément SGI</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleCompletionStatusUpdate("approved")} disabled={updating || (sgiCompletion as any).status === "approved"}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCompletionStatusUpdate("rejected")} disabled={updating || (sgiCompletion as any).status === "rejected"}>
                        <XCircle className="h-4 w-4 mr-1" /> Refuser
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="screening" className="space-y-4 mt-4">
                {pepScreening ? (
                  <div className={`rounded-lg border p-4 space-y-3 ${pepScreening.is_pep || pepScreening.sanctions_match ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5"}`}>
                    <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /><span className="font-semibold">PEP / Sanctions</span>
                      <Badge variant={pepScreening.is_pep || pepScreening.sanctions_match ? "destructive" : "default"}>Risque {pepScreening.risk_level}</Badge>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-muted-foreground text-xs uppercase mb-1">PEP</p><p className="font-medium">{pepScreening.is_pep ? "⚠️ Oui" : "✅ Non"}</p></div>
                      <div><p className="text-muted-foreground text-xs uppercase mb-1">Sanctions</p><p className="font-medium">{pepScreening.sanctions_match ? "⚠️ Oui" : "✅ Non"}</p></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8"><AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">Aucun screening effectué.</p></div>
                )}
              </TabsContent>

              <TabsContent value="comments" className="space-y-3 mt-4">
                {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun échange.</p>}
                {comments.map((c, i) => (
                  <div key={i} className={`rounded-lg p-3 text-sm ${
                    c.author_role === "sgi" ? "bg-primary/5 border border-primary/20" : c.author_role === "admin" ? "bg-accent/50 border border-border" : "bg-muted/50 border border-border ml-6"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{c.author_role === "sgi" ? "SGI" : c.author_role === "admin" ? "Admin" : "Investisseur"}</Badge>
                      {c.field_name && <Badge variant="secondary" className="text-xs">{c.field_name}</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <p>{c.comment}</p>
                  </div>
                ))}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex gap-2">
                    <Input placeholder="Champ (optionnel)" value={commentField} onChange={(e) => setCommentField(e.target.value)} className="w-1/3" />
                    <Input placeholder="Écrire un commentaire..." value={newComment} onChange={(e) => setNewComment(e.target.value)} className="flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }} />
                    <Button size="sm" onClick={handleSendComment} disabled={sendingComment || !newComment.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
