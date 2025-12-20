import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  Ban, 
  Gift, 
  RefreshCw, 
  Loader2, 
  Search,
  CheckCircle2,
  XCircle,
  MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserData {
  user_id: string;
  email?: string;
  plan_type: string;
  status: string;
  credits_remaining: number;
  project_count: number;
  avg_score: number;
  is_banned: boolean;
}

const AdminUsersList = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditAmount, setCreditAmount] = useState(5);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get all subscriptions (which includes user_ids)
      const { data: subscriptions, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subError) throw subError;

      // Get project counts and average scores per user
      const { data: projects, error: projError } = await supabase
        .from("projects_analysis")
        .select("user_id, portability_score");

      if (projError) throw projError;

      // Get banned users
      const { data: bannedUsers, error: banError } = await supabase
        .from("banned_users")
        .select("user_id");

      if (banError) throw banError;

      const bannedSet = new Set(bannedUsers?.map(b => b.user_id) || []);

      // Aggregate data
      const userMap = new Map<string, UserData>();

      subscriptions?.forEach(sub => {
        const userProjects = projects?.filter(p => p.user_id === sub.user_id) || [];
        const scores = userProjects.map(p => p.portability_score).filter(s => s !== null);
        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
          : 0;

        userMap.set(sub.user_id, {
          user_id: sub.user_id,
          plan_type: sub.plan_type,
          status: sub.status,
          credits_remaining: sub.credits_remaining || 0,
          project_count: userProjects.length,
          avg_score: avgScore,
          is_banned: bannedSet.has(sub.user_id),
        });
      });

      setUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleBanUser = async () => {
    if (!selectedUser || !currentUser) return;
    setActionLoading(true);

    try {
      if (selectedUser.is_banned) {
        // Unban
        const { error } = await supabase
          .from("banned_users")
          .delete()
          .eq("user_id", selectedUser.user_id);

        if (error) throw error;
        toast.success("Utilisateur débanni");
      } else {
        // Ban
        const { error } = await supabase
          .from("banned_users")
          .insert({
            user_id: selectedUser.user_id,
            banned_by: currentUser.id,
            reason: "Banned by admin",
          });

        if (error) throw error;
        toast.success("Utilisateur banni");
      }

      setShowBanDialog(false);
      fetchUsers();
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Erreur lors de l'action");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreditUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          credits_remaining: (selectedUser.credits_remaining || 0) + creditAmount,
          free_credits: creditAmount 
        })
        .eq("user_id", selectedUser.user_id);

      if (error) throw error;

      toast.success(`${creditAmount} crédits ajoutés`);
      setShowCreditDialog(false);
      fetchUsers();
    } catch (error) {
      console.error("Error crediting user:", error);
      toast.error("Erreur lors de l'ajout des crédits");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Liste des Utilisateurs
              </CardTitle>
              <CardDescription>{users.length} utilisateurs inscrits</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Utilisateur</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Crédits</TableHead>
                <TableHead>Projets</TableHead>
                <TableHead>Score Moyen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((userData) => (
                <TableRow key={userData.user_id} className={userData.is_banned ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-sm">
                    {userData.user_id.slice(0, 8)}...
                    {userData.is_banned && (
                      <Badge variant="destructive" className="ml-2">Banni</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {userData.plan_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {userData.status === "active" ? (
                      <Badge className="bg-success/10 text-success gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        {userData.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{userData.credits_remaining}</TableCell>
                  <TableCell>{userData.project_count}</TableCell>
                  <TableCell>
                    <Badge className={`${
                      userData.avg_score >= 80 
                        ? "bg-success/10 text-success" 
                        : userData.avg_score >= 60 
                          ? "bg-warning/10 text-warning" 
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {userData.avg_score}/100
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(userData);
                            setShowCreditDialog(true);
                          }}
                        >
                          <Gift className="h-4 w-4 mr-2" />
                          Créditer exports
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(userData);
                            setShowBanDialog(true);
                          }}
                          className={userData.is_banned ? "text-success" : "text-destructive"}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          {userData.is_banned ? "Débannir" : "Bannir"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ban Dialog */}
      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.is_banned ? "Débannir l'utilisateur" : "Bannir l'utilisateur"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.is_banned 
                ? "Cet utilisateur pourra à nouveau accéder à la plateforme."
                : "Cet utilisateur ne pourra plus accéder à la plateforme."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBanDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant={selectedUser?.is_banned ? "default" : "destructive"}
              onClick={handleBanUser}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedUser?.is_banned ? "Débannir" : "Bannir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Dialog */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créditer des exports gratuits</DialogTitle>
            <DialogDescription>
              Ajouter des crédits d'export gratuits à cet utilisateur
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
              min={1}
              max={100}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreditUser} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter {creditAmount} crédits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersList;
