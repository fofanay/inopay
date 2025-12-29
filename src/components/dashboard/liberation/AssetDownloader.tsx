import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Image,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Link as LinkIcon,
  FileImage,
  Folder,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface AssetInfo {
  url: string;
  path: string;
  type: "image" | "font" | "other";
  size?: number;
  status: "pending" | "downloading" | "success" | "error";
  localPath?: string;
  base64?: string;
  error?: string;
}

interface AssetDownloaderProps {
  files: Record<string, string>;
  onAssetsReady: (assets: Map<string, { content: string; isBase64: boolean }>) => void;
}

// URL patterns to detect
const ASSET_URL_PATTERNS = [
  // Lovable project URLs
  /https?:\/\/[a-z0-9-]+\.lovableproject\.com[^'\s)]+\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)/gi,
  // Supabase storage URLs
  /https?:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/[^'\s)]+/gi,
  // Generic CDN patterns
  /https?:\/\/cdn\.[^'\s)]+\.(png|jpg|jpeg|gif|webp|svg)/gi,
  // Other external image URLs in src/href
  /(?:src|href)=["']?(https?:\/\/[^'\s>]+\.(png|jpg|jpeg|gif|webp|svg|ico))["']?/gi,
];

// Patterns to replace in code
const URL_REPLACEMENT_PATTERNS = [
  { pattern: /https?:\/\/[a-z0-9-]+\.lovableproject\.com/g, name: "lovableproject.com" },
  { pattern: /https?:\/\/[a-z0-9]+\.supabase\.co\/storage/g, name: "supabase storage" },
];

/**
 * AssetDownloader - Télécharge automatiquement les assets externes
 * Récupère les images depuis les URLs externes et les intègre dans le pack
 */
export function AssetDownloader({ files, onAssetsReady }: AssetDownloaderProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [downloadedAssets, setDownloadedAssets] = useState<Map<string, { content: string; isBase64: boolean }>>(new Map());

  // Scan files for external asset URLs
  const scanForAssets = useCallback(() => {
    setIsScanning(true);
    const foundUrls = new Set<string>();
    const assetList: AssetInfo[] = [];

    for (const [filePath, content] of Object.entries(files)) {
      // Skip non-source files
      if (!/\.(tsx?|jsx?|css|scss|html)$/.test(filePath)) continue;

      for (const pattern of ASSET_URL_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
          // Extract clean URL
          let url = match[0];
          // Remove src= or href= prefix if present
          url = url.replace(/^(?:src|href)=["']?/, '');
          // Remove trailing quote if present
          url = url.replace(/["']$/, '');
          
          if (!foundUrls.has(url)) {
            foundUrls.add(url);
            
            // Determine asset type
            const ext = url.split('.').pop()?.toLowerCase() || '';
            let type: "image" | "font" | "other" = "other";
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) {
              type = "image";
            } else if (['woff', 'woff2', 'ttf', 'eot'].includes(ext)) {
              type = "font";
            }

            // Generate local path
            const fileName = url.split('/').pop()?.split('?')[0] || `asset-${foundUrls.size}.${ext}`;
            const localPath = `public/assets/${type === 'font' ? 'fonts/' : 'images/'}${fileName}`;

            assetList.push({
              url,
              path: filePath,
              type,
              status: "pending",
              localPath,
            });
          }
        }
      }
    }

    setAssets(assetList);
    setSelectedAssets(new Set(assetList.map(a => a.url)));
    setIsScanning(false);

    if (assetList.length === 0) {
      toast.info("Aucun asset externe détecté");
    } else {
      toast.success(`${assetList.length} assets externes détectés`);
    }
  }, [files]);

  // Download selected assets
  const downloadAssets = async () => {
    const toDownload = assets.filter(a => selectedAssets.has(a.url));
    if (toDownload.length === 0) {
      toast.warning("Aucun asset sélectionné");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    const downloaded = new Map<string, { content: string; isBase64: boolean }>();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toDownload.length; i++) {
      const asset = toDownload[i];
      
      // Update status to downloading
      setAssets(prev => prev.map(a => 
        a.url === asset.url ? { ...a, status: "downloading" } : a
      ));

      try {
        // Attempt to fetch the asset
        const response = await fetch(asset.url, {
          mode: 'cors',
          cache: 'force-cache',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const size = blob.size;

        // For small images (< 100KB), convert to base64
        // For larger files, we'll create a placeholder with instructions
        if (size < 100 * 1024 && asset.type === "image") {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          downloaded.set(asset.url, { content: base64, isBase64: true });
          
          setAssets(prev => prev.map(a => 
            a.url === asset.url ? { ...a, status: "success", size, base64 } : a
          ));
        } else {
          // For larger files, just mark as success and note the URL
          downloaded.set(asset.url, { 
            content: `/* Asset: ${asset.url} - Download manually or use CDN */`, 
            isBase64: false 
          });
          
          setAssets(prev => prev.map(a => 
            a.url === asset.url ? { ...a, status: "success", size } : a
          ));
        }

        successCount++;
      } catch (error: any) {
        // CORS errors or network failures
        downloaded.set(asset.url, { 
          content: `/* Failed to download: ${asset.url} - ${error.message} */`, 
          isBase64: false 
        });
        
        setAssets(prev => prev.map(a => 
          a.url === asset.url ? { ...a, status: "error", error: error.message } : a
        ));
        
        errorCount++;
      }

      setDownloadProgress(((i + 1) / toDownload.length) * 100);
    }

    setDownloadedAssets(downloaded);
    setIsDownloading(false);

    if (errorCount > 0) {
      toast.warning(`${successCount} téléchargés, ${errorCount} erreurs (CORS probable)`);
    } else {
      toast.success(`${successCount} assets téléchargés avec succès`);
    }

    // Notify parent
    onAssetsReady(downloaded);
  };

  // Toggle asset selection
  const toggleAsset = (url: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  // Stats
  const stats = useMemo(() => ({
    total: assets.length,
    selected: selectedAssets.size,
    images: assets.filter(a => a.type === "image").length,
    fonts: assets.filter(a => a.type === "font").length,
    success: assets.filter(a => a.status === "success").length,
    errors: assets.filter(a => a.status === "error").length,
  }), [assets, selectedAssets]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Téléchargement des Assets
            </CardTitle>
            <CardDescription>
              Récupère automatiquement les images et fonts depuis les URLs externes
            </CardDescription>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scanForAssets}
              disabled={isScanning || isDownloading}
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Scanner
            </Button>
            
            {assets.length > 0 && (
              <Button
                size="sm"
                onClick={downloadAssets}
                disabled={isDownloading || selectedAssets.size === 0}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Télécharger ({stats.selected})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar when downloading */}
        {isDownloading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Téléchargement en cours...</span>
              <span>{Math.round(downloadProgress)}%</span>
            </div>
            <Progress value={downloadProgress} />
          </div>
        )}

        {/* Stats badges */}
        {assets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <FileImage className="h-3 w-3 mr-1" />
              {stats.images} images
            </Badge>
            <Badge variant="outline">
              {stats.fonts} fonts
            </Badge>
            {stats.success > 0 && (
              <Badge variant="outline" className="bg-success/10 text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {stats.success} téléchargés
              </Badge>
            )}
            {stats.errors > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                {stats.errors} erreurs
              </Badge>
            )}
          </div>
        )}

        {/* CORS warning */}
        {assets.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Note:</strong> Certains assets peuvent échouer à cause des restrictions CORS. 
              Pour ces fichiers, téléchargez-les manuellement depuis les URLs.
            </AlertDescription>
          </Alert>
        )}

        {/* Asset list */}
        {assets.length > 0 ? (
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="divide-y">
              {assets.map((asset, idx) => (
                <motion.div
                  key={asset.url}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedAssets.has(asset.url)}
                    onCheckedChange={() => toggleAsset(asset.url)}
                    disabled={isDownloading}
                  />
                  
                  <div className={`p-2 rounded ${
                    asset.type === "image" ? "bg-blue-500/10" : 
                    asset.type === "font" ? "bg-purple-500/10" : 
                    "bg-muted"
                  }`}>
                    {asset.type === "image" ? (
                      <FileImage className="h-4 w-4 text-blue-500" />
                    ) : asset.type === "font" ? (
                      <FileImage className="h-4 w-4 text-purple-500" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">
                      {asset.url.split('/').pop()?.split('?')[0]}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{asset.path}</span>
                      {asset.size && <span>• {formatSize(asset.size)}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {asset.status === "downloading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {asset.status === "success" && (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    )}
                    {asset.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => window.open(asset.url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-8 text-center text-muted-foreground border rounded-lg border-dashed">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Cliquez sur "Scanner" pour détecter les assets externes</p>
            <p className="text-sm mt-1">URLs d'images, fonts et autres ressources</p>
          </div>
        )}

        {/* Download instructions for failed assets */}
        {stats.errors > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Assets à télécharger manuellement
            </h4>
            <div className="text-xs text-muted-foreground space-y-1">
              {assets.filter(a => a.status === "error").slice(0, 5).map(asset => (
                <div key={asset.url} className="flex items-center gap-2">
                  <code className="truncate flex-1">{asset.url}</code>
                  <span>→</span>
                  <code>{asset.localPath}</code>
                </div>
              ))}
              {stats.errors > 5 && (
                <div className="italic">... et {stats.errors - 5} autres</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
