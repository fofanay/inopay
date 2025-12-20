import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FlaskConical, 
  Plus, 
  Trash2, 
  Loader2, 
  RefreshCw,
  Crown,
  CheckCircle2,
  UserPlus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Tester {
  user_id: string;
  email: string;
  created_at: string;
  credits_remaining: number;
  project_count: number;
}

const AdminTesters = () => {
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTesterEmail, setNewTesterEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTesters = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session?.access_token) {
        throw new Error("No session");
      }

      // Get all users with unlimited credits (testers)
      const response = await supabase.functions.invoke("admin-list-users", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Filter users with 999999 credits (testers)
      const testerUsers = response.data?.users?.filter(
        (u: any) => u.credits_remaining >= 999999
      ) || [];

      setTesters(testerUsers);
    } catch (error) {
      console.error("Error fetching testers:", error);
      toast.error("Erreur lors du chargement des testeurs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTesters();
  }, []);

  const handleAddTester = async () => {
    if (!newTesterEmail.trim()) {
      toast.error("Veuillez entrer une adresse email");
      return;
    }

    setActionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("admin-manage-tester", {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: {
          action: "add",
          email: newTesterEmail.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`${newTesterEmail} ajouté comme testeur avec accès Pro illimité`);
      setNewTesterEmail("");
      setShowAddDialog(false);
      fetchTesters();
    } catch (error) {
      console.error("Error adding tester:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'ajout du testeur");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveTester = async (tester: Tester) => {
    setActionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("admin-manage-tester", {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: {
          action: "remove",
          user_id: tester.user_id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`Accès testeur retiré pour ${tester.email}`);
      fetchTesters();
    } catch (error) {
      console.error("Error removing tester:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors du retrait du testeur");
    } finally {
      setActionLoading(false);
    }
  };

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
                <FlaskConical className="h-5 w-5" />
                Comptes Testeurs
              </CardTitle>
              <CardDescription>
                {testers.length} compte{testers.length > 1 ? "s" : ""} avec accès Pro gratuit à vie
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchTesters}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un testeur
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {testers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun compte testeur configuré</p>
              <p className="text-sm">Ajoutez des testeurs pour leur donner un accès Pro gratuit à vie</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Projets analysés</TableHead>
                  <TableHead>Ajouté le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testers.map((tester) => (
                  <TableRow key={tester.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tester.email}</span>
                        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                          <Crown className="h-3 w-3" />
                          Testeur
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-success/10 text-success border-success/20 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Pro Illimité
                      </Badge>
                    </TableCell>
                    <TableCell>{tester.project_count}</TableCell>
                    <TableCell>
                      {new Date(tester.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveTester(tester)}
                        disabled={actionLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Tester Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Ajouter un testeur
            </DialogTitle>
            <DialogDescription>
              L'utilisateur recevra un accès Pro gratuit à vie avec des crédits illimités.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="email"
              placeholder="email@exemple.com"
              value={newTesterEmail}
              onChange={(e) => setNewTesterEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTester()}
            />
            <p className="text-xs text-muted-foreground mt-2">
              L'utilisateur doit déjà être inscrit sur la plateforme.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddTester} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter le testeur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTesters;
