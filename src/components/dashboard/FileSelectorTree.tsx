import { useState, useMemo, useCallback } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  FileImage, 
  File,
  Sparkles,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  size?: number;
}

interface FileSelectorTreeProps {
  files: Map<string, string>;
  selectedPaths: Set<string>;
  onSelectionChange: (paths: Set<string>) => void;
  maxFilesAllowed: number;
}

// Folders that should be auto-deselected (noisy)
const NOISY_FOLDERS = ['node_modules', 'dist', '.git', 'build', 'out', '.next', '.cache', 'coverage', '.turbo', '.vercel'];

// Folders that are AI recommended for cleaning
const AI_RECOMMENDED_FOLDERS = ['src', 'app', 'components', 'lib', 'hooks', 'utils', 'pages', 'features', 'modules'];

// Vital folders that should show warning when deselected
const VITAL_FOLDERS = ['src', 'app', 'components', 'lib'];

// File type icons
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['ts', 'tsx', 'js', 'jsx', 'vue', 'svelte'].includes(ext || '')) return FileCode;
  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml'].includes(ext || '')) return FileText;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) return FileImage;
  return File;
};

// Estimated tokens per character (rough approximation)
const CHARS_PER_TOKEN = 4;
const TOKENS_OVERHEAD_PER_FILE = 150;

// Build tree structure from flat file paths
function buildFileTree(files: Map<string, string>): FileNode[] {
  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  const sortedPaths = Array.from(files.keys()).sort();

  for (const path of sortedPaths) {
    const parts = path.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let existingNode = nodeMap.get(currentPath);

      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          size: isFile ? files.get(path)?.length || 0 : undefined,
        };
        nodeMap.set(currentPath, existingNode);
        currentLevel.push(existingNode);
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  return root;
}

// Count files in a node (recursive)
function countFilesInNode(node: FileNode): number {
  if (node.type === 'file') return 1;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countFilesInNode(child), 0);
}

// Count total characters in a node (recursive)
function countCharsInNode(node: FileNode, files: Map<string, string>): number {
  if (node.type === 'file') return files.get(node.path)?.length || 0;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + countCharsInNode(child, files), 0);
}

// Get all file paths in a node (recursive)
function getAllFilePaths(node: FileNode): string[] {
  if (node.type === 'file') return [node.path];
  if (!node.children) return [];
  return node.children.flatMap(child => getAllFilePaths(child));
}

// TreeNode component for recursive rendering
function TreeNode({
  node,
  files,
  selectedPaths,
  onToggle,
  expandedPaths,
  onToggleExpand,
  depth = 0,
  isNoisy,
  isRecommended,
}: {
  node: FileNode;
  files: Map<string, string>;
  selectedPaths: Set<string>;
  onToggle: (path: string, allPaths: string[]) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  depth?: number;
  isNoisy: boolean;
  isRecommended: boolean;
}) {
  const isFolder = node.type === 'folder';
  const isExpanded = expandedPaths.has(node.path);
  const fileCount = countFilesInNode(node);
  const charCount = countCharsInNode(node, files);
  const estimatedTokens = Math.ceil(charCount / CHARS_PER_TOKEN) + (fileCount * TOKENS_OVERHEAD_PER_FILE);
  
  // Calculate selection state
  const allPaths = getAllFilePaths(node);
  const selectedCount = allPaths.filter(p => selectedPaths.has(p)).length;
  const isFullySelected = selectedCount === allPaths.length && allPaths.length > 0;
  const isPartiallySelected = selectedCount > 0 && selectedCount < allPaths.length;

  const Icon = isFolder 
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(node.name);

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  const handleCheckChange = () => {
    onToggle(node.path, allPaths);
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      onToggleExpand(node.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          isNoisy && "opacity-50",
          isFullySelected && !isNoisy && "bg-slate-700/30",
          "hover:bg-slate-700/50"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleCheckChange}
      >
        <Checkbox
          checked={isFullySelected}
          className={cn(
            "border-slate-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary",
            isPartiallySelected && "bg-primary/30 border-primary"
          )}
          disabled={isNoisy}
          onCheckedChange={handleCheckChange}
        />
        
        {isFolder && (
          <button
            onClick={handleExpandToggle}
            className="p-0.5 hover:bg-slate-600/50 rounded"
          >
            <ChevronIcon className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
        
        <Icon className={cn(
          "h-4 w-4",
          isFolder ? "text-amber-400" : "text-slate-400",
          isNoisy && "text-slate-600"
        )} />
        
        <span className={cn(
          "font-mono text-sm flex-1",
          isNoisy ? "text-slate-500 line-through" : "text-slate-200"
        )}>
          {node.name}{isFolder ? '/' : ''}
        </span>

        {isRecommended && !isNoisy && (
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
            IA
          </Badge>
        )}

        {isNoisy && (
          <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-500 px-1.5 py-0">
            Ignoré
          </Badge>
        )}

        {isFolder && (
          <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 px-1.5 py-0 font-normal">
            {fileCount} fichiers
          </Badge>
        )}

        {!isNoisy && (
          <span className="text-[10px] text-slate-500 tabular-nums">
            ~{estimatedTokens.toLocaleString()} tok
          </span>
        )}
      </div>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              files={files}
              selectedPaths={selectedPaths}
              onToggle={onToggle}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
              isNoisy={isNoisy || NOISY_FOLDERS.includes(child.name)}
              isRecommended={AI_RECOMMENDED_FOLDERS.includes(child.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileSelectorTree({
  files,
  selectedPaths,
  onSelectionChange,
  maxFilesAllowed,
}: FileSelectorTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Auto-expand first level
    const initial = new Set<string>();
    const roots = new Set(Array.from(files.keys()).map(p => p.split('/')[0]));
    roots.forEach(r => initial.add(r));
    return initial;
  });

  const [deselectedVitalFolders, setDeselectedVitalFolders] = useState<string[]>([]);

  const tree = useMemo(() => buildFileTree(files), [files]);

  // Calculate stats
  const selectedFilesCount = selectedPaths.size;
  const totalFiles = files.size;
  
  const selectedChars = useMemo(() => {
    let total = 0;
    selectedPaths.forEach(path => {
      total += files.get(path)?.length || 0;
    });
    return total;
  }, [selectedPaths, files]);

  const estimatedTokens = Math.ceil(selectedChars / CHARS_PER_TOKEN) + (selectedFilesCount * TOKENS_OVERHEAD_PER_FILE);

  const isUnderLimit = selectedFilesCount <= maxFilesAllowed;

  const handleToggle = useCallback((path: string, allPaths: string[]) => {
    const newSelection = new Set(selectedPaths);
    const isCurrentlySelected = allPaths.every(p => selectedPaths.has(p));

    if (isCurrentlySelected) {
      // Deselect all
      allPaths.forEach(p => newSelection.delete(p));
      
      // Check for vital folder warning
      const rootFolder = path.split('/')[0];
      if (VITAL_FOLDERS.includes(rootFolder) && !deselectedVitalFolders.includes(rootFolder)) {
        setDeselectedVitalFolders(prev => [...prev, rootFolder]);
      }
    } else {
      // Select all (unless in noisy folder)
      const rootFolder = path.split('/')[0];
      if (!NOISY_FOLDERS.includes(rootFolder)) {
        allPaths.forEach(p => {
          // Check if file is in a noisy subfolder
          const pathParts = p.split('/');
          const isInNoisyFolder = pathParts.some(part => NOISY_FOLDERS.includes(part));
          if (!isInNoisyFolder) {
            newSelection.add(p);
          }
        });
      }
    }

    onSelectionChange(newSelection);
  }, [selectedPaths, onSelectionChange, deselectedVitalFolders]);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const dismissVitalWarning = (folder: string) => {
    setDeselectedVitalFolders(prev => prev.filter(f => f !== folder));
  };

  return (
    <div className="space-y-4">
      {/* Vital folder warnings */}
      {deselectedVitalFolders.map(folder => (
        <Alert 
          key={folder}
          className="bg-amber-500/10 border-amber-500/30 py-2"
        >
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-300 text-sm ml-2 flex items-center justify-between">
            <span>
              Attention : le dossier <code className="font-mono bg-amber-500/20 px-1 rounded">/{folder}</code> est essentiel pour une libération complète.
            </span>
            <button 
              onClick={() => dismissVitalWarning(folder)}
              className="text-amber-400 hover:text-amber-300 text-xs underline ml-2"
            >
              Compris
            </button>
          </AlertDescription>
        </Alert>
      ))}

      {/* Stats bar */}
      <div className="flex items-center justify-between p-3 bg-slate-800/70 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isUnderLimit ? "bg-green-500" : "bg-red-500"
            )} />
            <span className="text-sm text-slate-300">
              <span className={cn(
                "font-semibold",
                isUnderLimit ? "text-green-400" : "text-red-400"
              )}>
                {selectedFilesCount.toLocaleString()}
              </span>
              <span className="text-slate-500"> / {maxFilesAllowed.toLocaleString()} fichiers</span>
            </span>
          </div>
          
          <div className="h-4 w-px bg-slate-700" />
          
          <div className="text-sm text-slate-400">
            <span className="font-semibold text-slate-300">~{estimatedTokens.toLocaleString()}</span> tokens estimés
          </div>
        </div>

        {isUnderLimit && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Sous la limite gratuite
          </Badge>
        )}
      </div>

      {/* Tree view */}
      <ScrollArea className="h-[320px] rounded-lg border border-slate-700 bg-slate-900/80 p-2">
        <div className="space-y-0.5">
          {tree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              files={files}
              selectedPaths={selectedPaths}
              onToggle={handleToggle}
              expandedPaths={expandedPaths}
              onToggleExpand={handleToggleExpand}
              depth={0}
              isNoisy={NOISY_FOLDERS.includes(node.name)}
              isRecommended={AI_RECOMMENDED_FOLDERS.includes(node.name)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border border-slate-600 bg-slate-700/50" />
          <span>Sélectionné</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] px-1 py-0">
            <Sparkles className="h-2 w-2 mr-0.5" />
            IA
          </Badge>
          <span>Recommandé</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="line-through text-slate-600">ignoré</span>
          <span>Exclu auto.</span>
        </div>
      </div>
    </div>
  );
}
