import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Wrench, 
  RotateCcw, 
  Send, 
  Loader2, 
  Server,
  Bell,
  User,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface UserForNotification {
  id: string;
  email: string;
}

interface Deployment {
  id: string;
  project_name: string;
  status: string;
  server_id: string;
  user_id: string;
  deployed_url: string | null;
  created_at: string;
}

const AdminSupportTools = () => {
  const [users, setUsers] = useState<UserForNotification[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [redeploying, setRedeploying] = useState<string | null>(null);
  
  // Notification form
  const [notifUserId, setNotifUserId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState('info');
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch users from subscriptions (to get user IDs)
      const { data: subs, error: subsError } = await supabase
        .from('subscriptions')
        .select('user_id');
      
      if (subsError) throw subsError;

      // Get unique users with their emails via auth admin
      const uniqueUserIds = [...new Set(subs?.map(s => s.user_id) || [])];
      
      // For now, just use user IDs as we can't fetch emails without admin API
      const usersData = uniqueUserIds.map(id => ({
        id,
        email: `User ${id.slice(0, 8)}...`
      }));
      setUsers(usersData);

      // Fetch recent deployments
      const { data: deps, error: depsError } = await supabase
        .from('server_deployments')
        .select('id, project_name, status, server_id, user_id, deployed_url, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (depsError) throw depsError;
      setDeployments(deps || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleForceRedeploy = async (deployment: Deployment) => {
    setRedeploying(deployment.id);
    toast.info(`Redéploiement de ${deployment.project_name}...`);
    
    try {
      // Trigger restart via the auto-restart function
      const { error } = await supabase.functions.invoke('auto-restart-container', {
        body: {
          deployment_id: deployment.id,
          server_id: deployment.server_id
        }
      });

      if (error) throw error;

      // Log the action
      await supabase.from('admin_activity_logs').insert({
        action_type: 'force_redeploy',
        title: `Redéploiement forcé: ${deployment.project_name}`,
        description: `Admin a forcé le redéploiement du projet`,
        deployment_id: deployment.id,
        status: 'info',
        metadata: { triggered_by: 'admin' }
      });

      toast.success(`Redéploiement de ${deployment.project_name} déclenché`);
      fetchData();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setRedeploying(null);
    }
  };

  const handleSendNotification = async () => {
    if (!notifUserId || !notifTitle || !notifMessage) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setSendingNotification(true);
    try {
      const { error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: notifUserId,
          title: notifTitle,
          message: notifMessage,
          type: notifType,
        });

      if (error) throw error;

      // Log the action
      await supabase.from('admin_activity_logs').insert({
        action_type: 'notification_sent',
        title: `Notification envoyée`,
        description: notifTitle,
        user_id: notifUserId,
        status: 'success',
        metadata: { type: notifType }
      });

      toast.success("Notification envoyée avec succès");
      setNotifDialogOpen(false);
      setNotifTitle('');
      setNotifMessage('');
      setNotifUserId('');
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setSendingNotification(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Force Redeploy Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <RotateCcw className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-zinc-100">Forcer le Redéploiement</CardTitle>
                <CardDescription className="text-zinc-400">
                  Redémarrer un conteneur à distance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-400 mb-4">
              Sélectionnez un déploiement dans la liste ci-dessous pour le redémarrer.
            </p>
          </CardContent>
        </Card>

        {/* Send Notification Card */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Bell className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-zinc-100">Envoyer une Notification</CardTitle>
                <CardDescription className="text-zinc-400">
                  Notifier un utilisateur spécifique
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Dialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  <Send className="h-4 w-4 mr-2" />
                  Nouvelle Notification
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle className="text-zinc-100">Envoyer une Notification</DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Cette notification apparaîtra sur le dashboard de l'utilisateur
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-200">Utilisateur</Label>
                    <Select value={notifUserId} onValueChange={setNotifUserId}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                        <SelectValue placeholder="Sélectionner un utilisateur" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id} className="text-zinc-200">
                            {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-200">Type</Label>
                    <Select value={notifType} onValueChange={setNotifType}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        <SelectItem value="info" className="text-zinc-200">ℹ️ Info</SelectItem>
                        <SelectItem value="success" className="text-zinc-200">✅ Succès</SelectItem>
                        <SelectItem value="warning" className="text-zinc-200">⚠️ Avertissement</SelectItem>
                        <SelectItem value="error" className="text-zinc-200">❌ Erreur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-200">Titre</Label>
                    <Input 
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      placeholder="Titre de la notification"
                      className="bg-zinc-800 border-zinc-700 text-zinc-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-200">Message</Label>
                    <Textarea 
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      placeholder="Contenu du message..."
                      className="bg-zinc-800 border-zinc-700 text-zinc-200 min-h-[100px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setNotifDialogOpen(false)}
                    className="border-zinc-700 text-zinc-300"
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleSendNotification}
                    disabled={sendingNotification}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {sendingNotification ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Envoyer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Deployments Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Déploiements Récents</CardTitle>
          <CardDescription className="text-zinc-400">
            Sélectionnez un déploiement pour effectuer des actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun déploiement récent</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Projet</TableHead>
                  <TableHead className="text-zinc-400">Statut</TableHead>
                  <TableHead className="text-zinc-400">URL</TableHead>
                  <TableHead className="text-zinc-400">Date</TableHead>
                  <TableHead className="text-zinc-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((deployment) => (
                  <TableRow key={deployment.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="text-zinc-200 font-medium">
                      {deployment.project_name}
                    </TableCell>
                    <TableCell>
                      {deployment.status === 'deployed' ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Déployé
                        </Badge>
                      ) : deployment.status === 'failed' ? (
                        <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Échoué
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                          {deployment.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {deployment.deployed_url ? (
                        <a 
                          href={deployment.deployed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline text-sm"
                        >
                          {new URL(deployment.deployed_url).hostname}
                        </a>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {formatDistanceToNow(new Date(deployment.created_at), { addSuffix: true, locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => handleForceRedeploy(deployment)}
                        disabled={redeploying === deployment.id}
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      >
                        {redeploying === deployment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSupportTools;
