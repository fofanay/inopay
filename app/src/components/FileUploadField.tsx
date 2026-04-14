import React, { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, FileCheck, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FileUploadFieldProps {
  label: string;
  accept: string;
  value: string | null;
  onUploaded: (url: string) => void;
  folder: string; // maps to docType: id-document → id_document, etc.
}

const API_URL = import.meta.env.VITE_API_URL || 'https://api.getinopay.com';
const UPLOAD_URL = `${API_URL}/upload`;

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  label,
  accept,
  value,
  onUploaded,
  folder,
}) => {
  const [uploading, setUploading] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale est de 5 Mo.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Non authentifié");

        // Map folder names to docType parameter
        const docTypeMap: Record<string, string> = {
          "id-document": "id_document",
          "selfie": "selfie",
          "proof-of-residence": "proof_of_residence",
        };
        const docType = docTypeMap[folder] || folder.replace(/-/g, "_");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "kyc-documents");
        formData.append("docType", docType);

        const resp = await fetch(UPLOAD_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || "Erreur d'upload");
        }

        const data = await resp.json();
        setFileName(file.name);
        // Use "bucket/filename" as the stored path
        onUploaded(data.path || `${data.bucket}/${data.filename}`);

        toast({
          title: "Fichier chiffré et téléchargé",
          description: `${file.name} — protégé par chiffrement AES`,
        });
      } catch (err: any) {
        toast({
          title: "Erreur d'upload",
          description: err.message || "Réessayez.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [folder, onUploaded]
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-accent/50 px-4 py-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="flex-1 truncate text-sm text-foreground">
            {fileName || "Document chiffré"}
          </span>
          <button
            type="button"
            onClick={() => {
              onUploaded("");
              setFileName(null);
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/30">
          {uploading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Chiffrement et upload...
            </span>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Cliquez pour sélectionner un fichier
            </>
          )}
          <input
            type="file"
            accept={accept}
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
};
