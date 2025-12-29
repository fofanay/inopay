import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCode,
  ChevronDown,
  ChevronRight,
  Eye,
  Edit3,
  Check,
  X,
  Search,
  Filter,
  Copy,
  RotateCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface FileDiffPreviewProps {
  originalFiles: Map<string, string>;
  cleanedFiles: Record<string, string>;
  onUpdateFile: (path: string, content: string) => void;
  onRevertFile: (path: string) => void;
}

interface FileChange {
  path: string;
  original: string;
  cleaned: string;
  hasChanges: boolean;
  changeCount: number;
  type: "modified" | "removed" | "added";
}

/**
 * FileDiffPreview - Prévisualisation des fichiers modifiés avant génération
 * Permet de voir les changements et de corriger manuellement si nécessaire
 */
export function FileDiffPreview({
  originalFiles,
  cleanedFiles,
  onUpdateFile,
  onRevertFile,
}: FileDiffPreviewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "modified" | "removed" | "added">("all");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Calculate file changes
  const fileChanges = useMemo((): FileChange[] => {
    const changes: FileChange[] = [];
    
    // Check modified and removed files
    for (const [path, original] of originalFiles) {
      const cleaned = cleanedFiles[path];
      
      if (!cleaned) {
        changes.push({
          path,
          original,
          cleaned: "",
          hasChanges: true,
          changeCount: 0,
          type: "removed",
        });
      } else if (cleaned !== original) {
        // Count line changes
        const originalLines = original.split('\n');
        const cleanedLines = cleaned.split('\n');
        let changeCount = 0;
        
        const maxLines = Math.max(originalLines.length, cleanedLines.length);
        for (let i = 0; i < maxLines; i++) {
          if (originalLines[i] !== cleanedLines[i]) {
            changeCount++;
          }
        }
        
        changes.push({
          path,
          original,
          cleaned,
          hasChanges: true,
          changeCount,
          type: "modified",
        });
      }
    }
    
    // Check added files (polyfills, etc.)
    for (const path of Object.keys(cleanedFiles)) {
      if (!originalFiles.has(path)) {
        changes.push({
          path,
          original: "",
          cleaned: cleanedFiles[path],
          hasChanges: true,
          changeCount: cleanedFiles[path].split('\n').length,
          type: "added",
        });
      }
    }
    
    return changes.sort((a, b) => {
      // Sort by type first (modified, added, removed)
      const typeOrder = { modified: 0, added: 1, removed: 2 };
      if (typeOrder[a.type] !== typeOrder[b.type]) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      return a.path.localeCompare(b.path);
    });
  }, [originalFiles, cleanedFiles]);

  // Filter changes
  const filteredChanges = useMemo(() => {
    return fileChanges.filter(change => {
      const matchesSearch = change.path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === "all" || change.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [fileChanges, searchQuery, filterType]);

  // Stats
  const stats = useMemo(() => ({
    total: fileChanges.length,
    modified: fileChanges.filter(c => c.type === "modified").length,
    added: fileChanges.filter(c => c.type === "added").length,
    removed: fileChanges.filter(c => c.type === "removed").length,
  }), [fileChanges]);

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFiles(newExpanded);
  };

  const handleEdit = (path: string, content: string) => {
    setEditingFile(path);
    setEditContent(content);
  };

  const handleSaveEdit = () => {
    if (editingFile) {
      onUpdateFile(editingFile, editContent);
      toast.success(`Fichier ${editingFile.split('/').pop()} modifié`);
      setEditingFile(null);
      setEditContent("");
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Contenu copié");
  };

  const renderDiffContent = (original: string, cleaned: string) => {
    const originalLines = original.split('\n');
    const cleanedLines = cleaned.split('\n');
    
    const diffLines: Array<{ type: 'same' | 'removed' | 'added'; content: string; lineNum: number }> = [];
    
    // Simple diff algorithm
    let i = 0, j = 0;
    while (i < originalLines.length || j < cleanedLines.length) {
      if (i >= originalLines.length) {
        diffLines.push({ type: 'added', content: cleanedLines[j], lineNum: j + 1 });
        j++;
      } else if (j >= cleanedLines.length) {
        diffLines.push({ type: 'removed', content: originalLines[i], lineNum: i + 1 });
        i++;
      } else if (originalLines[i] === cleanedLines[j]) {
        diffLines.push({ type: 'same', content: originalLines[i], lineNum: i + 1 });
        i++;
        j++;
      } else {
        // Check if line was removed
        diffLines.push({ type: 'removed', content: originalLines[i], lineNum: i + 1 });
        i++;
        // Check if line was added
        if (j < cleanedLines.length && (i >= originalLines.length || originalLines[i] !== cleanedLines[j])) {
          diffLines.push({ type: 'added', content: cleanedLines[j], lineNum: j + 1 });
          j++;
        }
      }
    }
    
    // Only show first 50 lines of diff
    const visibleLines = diffLines.slice(0, 50);
    const hasMore = diffLines.length > 50;
    
    return (
      <div className="font-mono text-xs">
        {visibleLines.map((line, idx) => (
          <div
            key={idx}
            className={`px-2 py-0.5 ${
              line.type === 'removed'
                ? 'bg-destructive/20 text-destructive'
                : line.type === 'added'
                ? 'bg-success/20 text-success'
                : 'text-muted-foreground'
            }`}
          >
            <span className="inline-block w-8 text-muted-foreground/50 select-none">
              {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
            </span>
            <span className="whitespace-pre-wrap break-all">{line.content || ' '}</span>
          </div>
        ))}
        {hasMore && (
          <div className="px-2 py-1 text-muted-foreground italic">
            ... et {diffLines.length - 50} lignes supplémentaires
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Prévisualisation des modifications
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{stats.modified} modifiés</Badge>
            <Badge variant="outline" className="bg-success/10">{stats.added} ajoutés</Badge>
            <Badge variant="outline" className="bg-destructive/10">{stats.removed} supprimés</Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search and filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un fichier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous ({stats.total})</SelectItem>
              <SelectItem value="modified">Modifiés ({stats.modified})</SelectItem>
              <SelectItem value="added">Ajoutés ({stats.added})</SelectItem>
              <SelectItem value="removed">Supprimés ({stats.removed})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* File list */}
        <ScrollArea className="h-[400px] border rounded-lg">
          <div className="divide-y">
            {filteredChanges.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? "Aucun fichier ne correspond à la recherche" : "Aucune modification détectée"}
              </div>
            ) : (
              filteredChanges.map((change) => (
                <div key={change.path} className="border-b last:border-b-0">
                  {/* File header */}
                  <div
                    className="flex items-center gap-2 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleExpand(change.path)}
                  >
                    {expandedFiles.has(change.path) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    
                    <span className="flex-1 font-mono text-sm truncate">
                      {change.path}
                    </span>
                    
                    <Badge
                      variant="outline"
                      className={
                        change.type === "modified"
                          ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                          : change.type === "added"
                          ? "bg-success/10 text-success border-success/30"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                      }
                    >
                      {change.type === "modified" && `${change.changeCount} lignes`}
                      {change.type === "added" && "nouveau"}
                      {change.type === "removed" && "supprimé"}
                    </Badge>
                    
                    {change.type !== "removed" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(change.path, change.cleaned);
                          }}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyContent(change.cleaned);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {change.type === "modified" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRevertFile(change.path);
                              toast.info("Fichier restauré à l'original");
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Diff content */}
                  <AnimatePresence>
                    {expandedFiles.has(change.path) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-muted/30 border-t">
                          <Tabs defaultValue={change.type === "added" ? "after" : "diff"} className="w-full">
                            <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-8">
                              {change.type !== "added" && (
                                <TabsTrigger value="diff" className="text-xs h-7">
                                  Diff
                                </TabsTrigger>
                              )}
                              {change.type !== "removed" && (
                                <TabsTrigger value="after" className="text-xs h-7">
                                  Après nettoyage
                                </TabsTrigger>
                              )}
                              {change.type === "modified" && (
                                <TabsTrigger value="before" className="text-xs h-7">
                                  Avant
                                </TabsTrigger>
                              )}
                            </TabsList>
                            
                            {change.type !== "added" && (
                              <TabsContent value="diff" className="m-0">
                                <ScrollArea className="h-[200px]">
                                  {renderDiffContent(change.original, change.cleaned)}
                                </ScrollArea>
                              </TabsContent>
                            )}
                            
                            {change.type !== "removed" && (
                              <TabsContent value="after" className="m-0">
                                <ScrollArea className="h-[200px]">
                                  <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-all">
                                    {change.cleaned.slice(0, 5000)}
                                    {change.cleaned.length > 5000 && "\n... (contenu tronqué)"}
                                  </pre>
                                </ScrollArea>
                              </TabsContent>
                            )}
                            
                            {change.type === "modified" && (
                              <TabsContent value="before" className="m-0">
                                <ScrollArea className="h-[200px]">
                                  <pre className="p-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                                    {change.original.slice(0, 5000)}
                                    {change.original.length > 5000 && "\n... (contenu tronqué)"}
                                  </pre>
                                </ScrollArea>
                              </TabsContent>
                            )}
                          </Tabs>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Modifier {editingFile?.split('/').pop()}
            </DialogTitle>
          </DialogHeader>
          
          <div className="font-mono text-xs text-muted-foreground mb-2">
            {editingFile}
          </div>
          
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="font-mono text-xs h-[400px] resize-none"
          />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSaveEdit}>
              <Check className="h-4 w-4 mr-2" />
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
