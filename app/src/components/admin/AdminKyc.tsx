import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Shield, CheckCircle, XCircle, Eye, Clock, Users, Loader2, Download, Bot, AlertTriangle, Send, MessageSquare, Globe, FileText,
} from "lucide-react";

interface KycEntry {
  id: string;
  user_id: string;
  full_name: string | null;
  address: string | null;
  date_of_birth: string | null;
  status: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  id_document_url: string | null;
  selfie_url: string | null;
  proof_of_residence_url: string | null;
  target_market: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  id_type: string | null;
  id_number: string | null;
  id_expiry_date: string | null;
  profession: string | null;
  source_of_funds: string | null;
  tax_id: string | null;
  employer: string | null;
  phone: string | null;
  risk_level: string | null;
  review_note: string | null;
  // Regulatory fields
  is_us_person: boolean | null;
  crs_tax_country: string | null;
  political_exposure_self: boolean | null;
  annual_income_range: string | null;
  investment_experience: string | null;
  investment_objectives: string | null;
  due_diligence_level: string | null;
  gdpr_consent: boolean | null;
  gdpr_consent_at: string | null;
  next_review_date: string | null;
  document_verified_at: string | null;
  submission_attempts: number | null;
}

interface AiAnalysis {
  risk_level: string | null;
  recommendation: string | null;
  anomalies: any;
}

interface PepScreening {
  is_pep: boolean;
  pep_details: string | null;
  sanctions_match: boolean;
  sanctions_details: string | null;
  risk_level: string;
  source?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  EN_ATTENTE: { label: "En attente", variant: "default" },
  EN_REVISION: { label: "En révision", variant: "secondary" },
  VALIDE: { label: "Validé", variant: "outline" },
  REFUSE: { label: "Refusé", variant: "destructive" },
  BROUILLON: { label: "Brouillon", variant: "secondary" },
  NON_COMMENCE: { label: "Non commencé", variant: "secondary" },
};

const marketLabels: Record<string, string> = { BRVM: "🇨🇮 BRVM", BVMAC: "🇨🇲 BVMAC", GSE: "🇬🇭 GSE" };

const ddLabels: Record<string, string> = { simplified: "Simplifié", standard: "Standard", enhanced: "Renforcé" };

const API_URL = import.meta.env.VITE_API_URL || 'https://api.getinopay.com';
const DOWNLOAD_URL = `${API_URL}/upload/download`;

export const AdminKyc: React.FC = () => {
  const [kycs, setKycs] = useState<KycEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<KycEntry | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<string>("EN_ATTENTE");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [runningAi, setRunningAi] = useState(false);
  const [pepScreening, setPepScreening] = useState<PepScreening | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentField, setCommentField] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  const fetchKycs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("kycs").select("*").order("submitted_at", { ascending: false });
    if (filter !== "ALL") query = query.eq("status", filter as any);
    const { data } = await query;
    setKycs((data || []) as KycEntry[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchKycs(); }, [fetchKycs]);

  const handleDownload = async (path: string, label: string) => {
    setDownloading(path);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const resp = await fetch(`${DOWNLOAD_URL}&path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!resp.ok) throw new Error("Erreur de téléchargement");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) { const a = document.createElement("a"); a.href = url; a.download = label; a.click(); }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setDownloading(null); }
  };

  const handleRunAiValidation = async (kyc: KycEntry) => {
    setRunningAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("kyc-ai-validate", { body: { kyc_id: kyc.id } });
      if (error) throw error;
      setAiAnalysis(data?.analysis || null);
      if (data?.pep_screening) setPepScreening(data.pep_screening);
      if (data?.auto_approved) {
        toast({ title: "KYC auto-approuvé par l'IA", description: `Le dossier de ${kyc.full_name} a été validé automatiquement.` });
        fetchKycs();
      } else {
        toast({ title: "Analyse IA terminée", description: data?.analysis?.recommendation || "Vérification manuelle requise." });
      }
    } catch (err: any) {
      toast({ title: "Erreur IA", description: err.message, variant: "destructive" });
    } finally { setRunningAi(false); }
  };

  const handleSelectKyc = async (kyc: KycEntry) => {
    setSelected(kyc);
    setAiAnalysis(null);
    setPepScreening(null);
    setComments([]);
    setAuditLog([]);
    setReviewNote(kyc.review_note || "");

    const [analysisRes, pepRes, commentsRes, auditRes] = await Promise.all([
      supabase.from("ai_kyc_analysis").select("risk_level, recommendation, anomalies").eq("kyc_id", kyc.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("kyc_pep_screening").select("is_pep, pep_details, sanctions_match, sanctions_details, risk_level, source").eq("kyc_id", kyc.id).order("screened_at", { ascending: false }).limit(1),
      supabase.from("kyc_review_comments").select("*").eq("kyc_id", kyc.id).order("created_at", { ascending: true }),
      supabase.from("kyc_audit_log").select("*").eq("kyc_id", kyc.id).order("created_at", { ascending: false }).limit(20),
    ]);

    if (analysisRes.data?.[0]) setAiAnalysis(analysisRes.data[0]);
    if (pepRes.data?.[0]) setPepScreening(pepRes.data[0] as PepScreening);
    setComments(commentsRes.data || []);
    setAuditLog(auditRes.data || []);
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !selected) return;
    setSendingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("kyc_review_comments").insert({
        kyc_id: selected.id, author_id: user.id, author_role: "admin", comment: newComment.trim(),
        field_name: commentField || null,
      } as any);
      if (error) throw error;
      setComments((prev) => [...prev, { author_role: "admin", comment: newComment.trim(), field_name: commentField || null, created_at: new Date().toISOString() }]);
      setNewComment("");
      setCommentField("");
      toast({ title: "Commentaire envoyé" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setSendingComment(false); }
  };

  const handleReview = async (status: "VALIDE" | "REFUSE") => {
    if (!selected) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("kycs").update({
        status: status as any, reviewed_at: new Date().toISOString(),
        reviewer_id: user?.id, review_note: reviewNote || null,
      } as any).eq("id", selected.id);
      if (error) throw error;

      await supabase.from("system_logs").insert({
        action: `kyc_${status.toLowerCase()}`,
        details: `KYC ${selected.id} for ${selected.full_name} - ${status}${reviewNote ? `: ${reviewNote}` : ""}`,
        actor_id: user?.id || null,
      });

      // Trigger email notification
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: selected.user_id,
            template: status === "VALIDE" ? "kyc_approved" : "kyc_refused",
            subject: status === "VALIDE" ? "KYC approuvé — INOPAY" : "KYC refusé — INOPAY",
          },
        });
      } catch { /* silent */ }

      toast({
        title: status === "VALIDE" ? "KYC approuvé" : "KYC refusé",
        description: `Le dossier de ${selected.full_name} a été ${status === "VALIDE" ? "approuvé" : "refusé"}.`,
      });
      setSelected(null); setReviewNote(""); setAiAnalysis(null); setPepScreening(null);
      fetchKycs();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setProcessing(false); }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="flex items-center gap-3 py-4"><Clock className="h-5 w-5 text-warning" /><div><p className="text-2xl font-bold">{kycs.length}</p><p className="text-xs text-muted-foreground">Dossiers ({filter === "ALL" ? "tous" : statusConfig[filter]?.label || filter})</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 py-4"><Bot className="h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Validation IA + OpenSanctions</p><p className="text-xs text-muted-foreground">Screening PEP/sanctions réel activé</p></div></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["EN_ATTENTE", "EN_REVISION", "VALIDE", "REFUSE", "BROUILLON", "ALL"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "ALL" ? "Tous" : statusConfig[f]?.label || f}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Dossiers KYC</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : kycs.length === 0 ? (
            <div className="text-center py-10"><Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">Aucun dossier KYC trouvé</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Marché</TableHead>
                  <TableHead>DD</TableHead>
                  <TableHead>Soumis le</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kycs.map((kyc) => {
                  const cfg = statusConfig[kyc.status || "NON_COMMENCE"] || statusConfig.NON_COMMENCE;
                  return (
                    <TableRow key={kyc.id}>
                      <TableCell className="font-medium">{kyc.full_name || "—"}</TableCell>
                      <TableCell>{kyc.target_market ? <Badge variant="outline" className="text-xs">{marketLabels[kyc.target_market] || kyc.target_market}</Badge> : "—"}</TableCell>
                      <TableCell>
                        {kyc.due_diligence_level ? (
                          <Badge variant={kyc.due_diligence_level === "enhanced" ? "destructive" : "outline"} className="text-xs">
                            {ddLabels[kyc.due_diligence_level] || kyc.due_diligence_level}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleDateString("fr-FR") : "—"}</TableCell>
                      <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => handleSelectKyc(kyc)}><Eye className="h-4 w-4 mr-1" />Examiner</Button>
                        {(kyc.status === "EN_ATTENTE" || kyc.status === "EN_REVISION") && (
                          <Button size="sm" variant="secondary" onClick={() => handleRunAiValidation(kyc)} disabled={runningAi}><Bot className="h-4 w-4 mr-1" />{runningAi ? "Analyse..." : "IA"}</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setAiAnalysis(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Examen KYC — {selected?.full_name}
              {selected?.target_market && <Badge variant="outline">{marketLabels[selected.target_market] || selected.target_market}</Badge>}
              {selected?.due_diligence_level && (
                <Badge variant={selected.due_diligence_level === "enhanced" ? "destructive" : "outline"} className="text-xs">
                  DD: {ddLabels[selected.due_diligence_level] || selected.due_diligence_level}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>Vérifiez les informations et documents avant d'approuver ou refuser.</DialogDescription>
          </DialogHeader>

          {selected && (
            <Tabs defaultValue="info" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Identité</TabsTrigger>
                <TabsTrigger value="financial" className="flex-1">Financier</TabsTrigger>
                <TabsTrigger value="regulatory" className="flex-1">Réglementaire</TabsTrigger>
                <TabsTrigger value="docs" className="flex-1">Documents</TabsTrigger>
                <TabsTrigger value="comments" className="flex-1">Échanges ({comments.length})</TabsTrigger>
                <TabsTrigger value="audit" className="flex-1">Audit ({auditLog.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Nom complet", selected.full_name],
                    ["Date de naissance", selected.date_of_birth],
                    ["Nationalité", selected.nationality],
                    ["Pays de résidence", selected.country_of_residence],
                    ["Téléphone", selected.phone],
                    ["Type de pièce", selected.id_type],
                    ["N° document", selected.id_number],
                    ["Expiration", selected.id_expiry_date],
                    ["Tentatives", String(selected.submission_attempts || 0)],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{val || "—"}</p>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Adresse</p>
                    <p className="font-medium">{selected.address || "—"}</p>
                  </div>
                </div>

                {aiAnalysis && (
                  <div className={`rounded-lg border p-3 space-y-2 ${
                    aiAnalysis.risk_level === "low" ? "border-green-500/30 bg-green-500/5" :
                    aiAnalysis.risk_level === "high" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" /><span className="text-sm font-semibold">Analyse IA</span>
                      <Badge variant={aiAnalysis.risk_level === "low" ? "outline" : aiAnalysis.risk_level === "high" ? "destructive" : "default"}>Risque : {aiAnalysis.risk_level || "inconnu"}</Badge>
                    </div>
                    <p className="text-sm">{aiAnalysis.recommendation}</p>
                    {aiAnalysis.anomalies && Array.isArray(aiAnalysis.anomalies) && aiAnalysis.anomalies.length > 0 && (
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        {aiAnalysis.anomalies.map((a: string, i: number) => <li key={i}>{a}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {pepScreening && (
                  <div className={`rounded-lg border p-3 space-y-1 ${pepScreening.is_pep || pepScreening.sanctions_match ? "border-destructive/30 bg-destructive/5" : "border-green-500/30 bg-green-500/5"}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-semibold">PEP / Sanctions</span>
                      {pepScreening.source && <Badge variant="outline" className="text-xs">{pepScreening.source}</Badge>}
                    </div>
                    <p className="text-xs">PEP : {pepScreening.is_pep ? `Oui — ${pepScreening.pep_details}` : "Non"}</p>
                    <p className="text-xs">Sanctions : {pepScreening.sanctions_match ? `Oui — ${pepScreening.sanctions_details}` : "Non"}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="financial" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Profession", selected.profession],
                    ["Employeur", selected.employer],
                    ["Source des revenus", selected.source_of_funds],
                    ["N° fiscal", selected.tax_id],
                    ["Revenu annuel", selected.annual_income_range],
                    ["Expérience invest.", selected.investment_experience],
                    ["Objectifs", selected.investment_objectives],
                    ["Niveau de risque", selected.risk_level],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{val || "—"}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="regulatory" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["FATCA (US Person)", selected.is_us_person ? "🇺🇸 Oui" : "Non"],
                    ["Résidence fiscale CRS", selected.crs_tax_country || "—"],
                    ["PEP auto-déclaré", selected.political_exposure_self ? "⚠️ Oui" : "Non"],
                    ["Due Diligence", ddLabels[selected.due_diligence_level || "standard"] || "Standard"],
                    ["RGPD Consentement", selected.gdpr_consent ? `✓ ${selected.gdpr_consent_at ? new Date(selected.gdpr_consent_at).toLocaleDateString("fr-FR") : ""}` : "✗ Non"],
                    ["Prochaine révision", selected.next_review_date || "—"],
                    ["Document vérifié", selected.document_verified_at ? new Date(selected.document_verified_at).toLocaleDateString("fr-FR") : "Non vérifié"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{val}</p>
                    </div>
                  ))}
                </div>
                {selected.political_exposure_self && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Auto-déclaration PEP
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      L'investisseur s'est déclaré comme Personne Politiquement Exposée. Due diligence renforcée requise.
                    </p>
                  </div>
                )}
                {selected.is_us_person && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span>🇺🇸</span> Déclaration FATCA
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cet investisseur est déclaré US Person. Obligations FATCA applicables.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="docs" className="space-y-2 mt-4">
                <p className="text-sm font-semibold">Documents (chiffrés AES-256)</p>
                {[
                  { label: "Pièce d'identité", path: selected.id_document_url },
                  { label: "Selfie", path: selected.selfie_url },
                  { label: "Justificatif de résidence", path: selected.proof_of_residence_url },
                ].map((doc) => (
                  <div key={doc.label} className="flex items-center justify-between rounded-lg border p-2">
                    <span className="text-sm">{doc.label}</span>
                    {doc.path ? (
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.path!, doc.label)} disabled={downloading === doc.path}>
                        {downloading === doc.path ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                        Déchiffrer & voir
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">Non fourni</span>}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="comments" className="space-y-3 mt-4">
                {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun échange pour ce dossier.</p>}
                {comments.map((c, i) => (
                  <div key={i} className={`rounded-lg p-3 text-sm ${
                    c.author_role === "admin" ? "bg-primary/5 border border-primary/20" : c.author_role === "sgi" ? "bg-accent/50 border border-border" : "bg-muted/50 border border-border ml-6"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{c.author_role === "admin" ? "Admin" : c.author_role === "sgi" ? "SGI" : "Investisseur"}</Badge>
                      {c.field_name && <Badge variant="secondary" className="text-xs">{c.field_name}</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <p>{c.comment}</p>
                  </div>
                ))}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex gap-2">
                    <Input placeholder="Champ concerné (optionnel)" value={commentField} onChange={(e) => setCommentField(e.target.value)} className="w-1/3" />
                    <Input placeholder="Écrire un commentaire..." value={newComment} onChange={(e) => setNewComment(e.target.value)} className="flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }} />
                    <Button size="sm" onClick={handleSendComment} disabled={sendingComment || !newComment.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audit" className="space-y-2 mt-4">
                <p className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Historique des modifications</p>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune entrée d'audit.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {auditLog.map((entry, i) => (
                      <div key={i} className="rounded-lg border p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">{entry.change_type}</Badge>
                          <span className="text-muted-foreground">{new Date(entry.created_at).toLocaleString("fr-FR")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium">Note de révision (optionnel)</label>
            <Textarea placeholder="Raison du refus ou commentaire..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            {(selected?.status === "EN_ATTENTE" || selected?.status === "EN_REVISION") && (
              <Button variant="secondary" onClick={() => selected && handleRunAiValidation(selected)} disabled={runningAi}>
                <Bot className="h-4 w-4 mr-1" />{runningAi ? "Analyse..." : "Analyser par IA"}
              </Button>
            )}
            <Button variant="destructive" onClick={() => handleReview("REFUSE")} disabled={processing}><XCircle className="h-4 w-4 mr-1" />Refuser</Button>
            <Button onClick={() => handleReview("VALIDE")} disabled={processing}><CheckCircle className="h-4 w-4 mr-1" />Approuver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
