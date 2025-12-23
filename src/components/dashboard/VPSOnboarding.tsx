import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { HetznerAutoProvision } from './HetznerAutoProvision';
import { useTranslation } from 'react-i18next';
import { 
  Server, 
  Copy, 
  Check, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  Terminal,
  Shield,
  Zap,
  Sparkles
} from 'lucide-react';

interface VPSProvider {
  id: string;
  name: string;
  logo: string;
  signupUrl: string;
  minPrice: string;
}

const VPS_PROVIDERS: VPSProvider[] = [
  { id: 'hetzner', name: 'Hetzner', logo: '🇩🇪', signupUrl: 'https://www.hetzner.com/cloud', minPrice: '5$/mois' },
  { id: 'digitalocean', name: 'DigitalOcean', logo: '🌊', signupUrl: 'https://www.digitalocean.com/', minPrice: '6$/mois' },
  { id: 'vultr', name: 'Vultr', logo: '⚡', signupUrl: 'https://www.vultr.com/', minPrice: '4$/mois' },
  { id: 'ionos', name: 'IONOS', logo: '🌐', signupUrl: 'https://www.ionos.ca/serveur/vps', minPrice: '2$/mois' },
  { id: 'scaleway', name: 'Scaleway', logo: '🇫🇷', signupUrl: 'https://www.scaleway.com/', minPrice: '4$/mois' },
  { id: 'ovh', name: 'OVH', logo: '🇨🇦', signupUrl: 'https://www.ovhcloud.com/en-ca/vps/', minPrice: '5$/mois' },
];

interface UserServer {
  id: string;
  name: string;
  ip_address: string;
  provider: string;
  status: string;
  coolify_url: string | null;
  setup_id: string;
  created_at: string;
}

export function VPSOnboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [hasExistingVPS, setHasExistingVPS] = useState<boolean | null>(null);
  const [showCreationGuide, setShowCreationGuide] = useState(false);
  const [showAutoProvision, setShowAutoProvision] = useState(false);
  const [provider, setProvider] = useState('hetzner');
  const [serverName, setServerName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [installCommand, setInstallCommand] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentServer, setCurrentServer] = useState<UserServer | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentServer && (currentServer.status === 'pending' || currentServer.status === 'installing')) {
      interval = setInterval(async () => {
        setCheckingStatus(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { data, error } = await supabase.functions.invoke('check-server-status', {
            body: { server_id: currentServer.id }
          });

          if (!error && data.status === 'ready') {
            setCurrentServer(prev => prev ? { ...prev, status: 'ready', coolify_url: data.coolify_url } : null);
            toast({
              title: t('vpsOnboarding.serverReady'),
              description: t('vpsOnboarding.serverReadyDesc'),
            });
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Status check error:', err);
        } finally {
          setCheckingStatus(false);
        }
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentServer, toast, t]);

  const handleSetupServer = async () => {
    if (!serverName || !ipAddress) {
      toast({
        title: t('common.error'),
        description: t('vpsOnboarding.fillAllFields'),
        variant: "destructive"
      });
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      toast({
        title: t('common.error'),
        description: t('vpsOnboarding.invalidIp'),
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t('common.error'),
          description: t('vpsOnboarding.mustBeLoggedIn'),
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('setup-vps', {
        body: { name: serverName, ip_address: ipAddress, provider }
      });

      if (error) throw error;

      setInstallCommand(data.installCommand);
      setCurrentServer(data.server);
      setStep(3);

      toast({
        title: t('vpsOnboarding.serverRegistered'),
        description: t('vpsOnboarding.serverRegisteredDesc'),
      });
    } catch (error: any) {
      console.error('Setup error:', error);
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: t('vpsOnboarding.copied'),
      description: t('vpsOnboarding.copyDesc'),
    });
  };

  const renderStep0 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{t('vpsOnboarding.configQuestion')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('vpsOnboarding.configSubtitle')}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 ${
            hasExistingVPS === true ? 'border-primary ring-2 ring-primary/20' : ''
          }`}
          onClick={() => {
            setHasExistingVPS(true);
            setShowAutoProvision(false);
            setStep(1);
          }}
        >
          <CardContent className="pt-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-success" />
            </div>
            <h4 className="font-medium">{t('vpsOnboarding.existingVps')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('vpsOnboarding.existingVpsDesc')}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all hover:border-primary/50 border-primary/30 relative"
          onClick={() => {
            setHasExistingVPS(false);
            setShowAutoProvision(true);
            setProvider('hetzner');
          }}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              {t('vpsOnboarding.recommended')}
            </Badge>
          </div>
          <CardContent className="pt-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <h4 className="font-medium">{t('vpsOnboarding.autoProvision')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('vpsOnboarding.autoProvisionDesc')}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer transition-all hover:border-primary/50"
          onClick={() => {
            setHasExistingVPS(false);
            setShowAutoProvision(false);
            setShowCreationGuide(true);
            setStep(1);
          }}
        >
          <CardContent className="pt-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <Server className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium">{t('vpsOnboarding.manualGuide')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('vpsOnboarding.manualGuideDesc')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          {t('vpsOnboarding.whyVps')}
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>{t('vpsOnboarding.whyVpsReasons.control').split(':')[0]}</strong>: {t('vpsOnboarding.whyVpsReasons.control').split(':')[1]}</li>
          <li>• <strong>{t('vpsOnboarding.whyVpsReasons.economic').split(':')[0]}</strong>: {t('vpsOnboarding.whyVpsReasons.economic').split(':')[1]}</li>
          <li>• <strong>{t('vpsOnboarding.whyVpsReasons.performance').split(':')[0]}</strong>: {t('vpsOnboarding.whyVpsReasons.performance').split(':')[1]}</li>
          <li>• <strong>{t('vpsOnboarding.whyVpsReasons.sovereignty').split(':')[0]}</strong>: {t('vpsOnboarding.whyVpsReasons.sovereignty').split(':')[1]}</li>
        </ul>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{t('vpsOnboarding.chooseProvider')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('vpsOnboarding.chooseProviderDesc')}
        </p>
      </div>

      <RadioGroup value={provider} onValueChange={setProvider} className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {VPS_PROVIDERS.map((p) => (
          <div key={p.id}>
            <RadioGroupItem value={p.id} id={p.id} className="peer sr-only" />
            <Label
              htmlFor={p.id}
              className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
            >
              <span className="text-2xl mb-2">{p.logo}</span>
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.minPrice}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" size="sm" onClick={() => setStep(0)}>
          {t('vpsOnboarding.back')}
        </Button>

        <div className="flex gap-2">
          {showCreationGuide && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedProvider = VPS_PROVIDERS.find(p => p.id === provider);
                if (selectedProvider) {
                  window.open(selectedProvider.signupUrl, '_blank');
                }
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {t('vpsOnboarding.createAccount')} {VPS_PROVIDERS.find(p => p.id === provider)?.name}
            </Button>
          )}

          <Button onClick={() => setStep(2)}>
            {t('vpsOnboarding.continue')}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{t('vpsOnboarding.serverInfo')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('vpsOnboarding.serverInfoDesc')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="serverName">{t('vpsOnboarding.serverName')}</Label>
          <Input
            id="serverName"
            placeholder={t('vpsOnboarding.serverNamePlaceholder')}
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ipAddress">{t('vpsOnboarding.ipAddress')}</Label>
          <Input
            id="ipAddress"
            placeholder={t('vpsOnboarding.ipAddressPlaceholder')}
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('vpsOnboarding.ipAddressDesc')}
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-500" />
          {t('vpsOnboarding.requirements')}
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• {t('vpsOnboarding.requirementsList.ubuntu')}</li>
          <li>• {t('vpsOnboarding.requirementsList.minSpecs')}</li>
          <li>• {t('vpsOnboarding.requirementsList.rootAccess')}</li>
          <li>• {t('vpsOnboarding.requirementsList.portsOpen')}</li>
        </ul>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep(1)}>
          {t('vpsOnboarding.back')}
        </Button>
        <Button onClick={handleSetupServer} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('vpsOnboarding.configuring')}
            </>
          ) : (
            <>
              {t('vpsOnboarding.configure')}
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{t('vpsOnboarding.installCoolify')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('vpsOnboarding.installCoolifyDesc')}
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-zinc-900 text-zinc-100 rounded-lg p-4 font-mono text-sm">
          <div className="flex items-start justify-between gap-4">
            <code className="break-all">{installCommand}</code>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-zinc-400 hover:text-zinc-100"
              onClick={copyCommand}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Terminal className="w-4 h-4" />
          <span>{t('vpsOnboarding.sshConnect')} <code className="bg-muted px-1 rounded">ssh root@{ipAddress}</code></span>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {currentServer?.status === 'ready' ? (
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
            ) : (
              <Loader2 className="w-5 h-5 text-primary animate-spin mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <p className="font-medium">
                {currentServer?.status === 'ready' 
                  ? t('vpsOnboarding.serverReady')
                  : currentServer?.status === 'installing'
                    ? t('vpsOnboarding.installing')
                    : t('vpsOnboarding.waitingInstall')}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentServer?.status === 'ready' 
                  ? t('vpsOnboarding.serverReadyDesc')
                  : t('vpsOnboarding.waitingInstallDesc')}
              </p>
              {currentServer?.coolify_url && (
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm"
                  onClick={() => window.open(currentServer.coolify_url!, '_blank')}
                >
                  {t('coolifyConfig.openCoolify')} <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            {checkingStatus && (
              <Badge variant="secondary" className="shrink-0">
                {t('vpsOnboarding.checking')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          {t('vpsOnboarding.scriptDoes')}
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>1. {t('vpsOnboarding.scriptSteps.update')}</li>
          <li>2. {t('vpsOnboarding.scriptSteps.docker')}</li>
          <li>3. {t('vpsOnboarding.scriptSteps.coolify')}</li>
          <li>4. {t('vpsOnboarding.scriptSteps.callback')}</li>
        </ul>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep(2)}>
          {t('vpsOnboarding.back')}
        </Button>
        {currentServer?.status === 'ready' && (
          <Button onClick={() => setStep(4)}>
            {t('vpsOnboarding.continueDeployment')}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">{t('common.success')}!</h3>
        <p className="text-sm text-muted-foreground">
          {t('vpsOnboarding.serverReadyDesc')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            {serverName}
          </CardTitle>
          <CardDescription>{ipAddress}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('analyzedProjects.columns.status')}</span>
            <Badge variant="default" className="bg-green-500">{t('serverManagement.status.ready')}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('serverManagement.provider')}</span>
            <span className="text-sm">{VPS_PROVIDERS.find(p => p.id === provider)?.name}</span>
          </div>
          {currentServer?.coolify_url && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Coolify</span>
              <Button
                variant="link"
                className="p-0 h-auto text-sm"
                onClick={() => window.open(currentServer.coolify_url!, '_blank')}
              >
                {t('coolifyConfig.openCoolify')} <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const handleAutoProvisionSuccess = (serverData: {
    id: string;
    name: string;
    ip_address: string;
    credentials: { root_password: string; ssh_command: string };
    installCommand: string;
  }) => {
    setServerName(serverData.name);
    setIpAddress(serverData.ip_address);
    setInstallCommand(serverData.installCommand);
    setCurrentServer({
      id: serverData.id,
      name: serverData.name,
      ip_address: serverData.ip_address,
      provider: 'hetzner',
      status: 'provisioning',
      coolify_url: null,
      setup_id: '',
      created_at: new Date().toISOString(),
    });
    setShowAutoProvision(false);
    setStep(3);
  };

  if (showAutoProvision) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <HetznerAutoProvision 
            onSuccess={handleAutoProvisionSuccess}
            onBack={() => {
              setShowAutoProvision(false);
              setStep(0);
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>{t('serverManagement.addServer')}</CardTitle>
            <CardDescription>
              {t('serverManagement.subtitle')}
            </CardDescription>
          </div>
        </div>
        
        {step > 0 && !showAutoProvision && (
          <div className="flex items-center gap-2 pt-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    s < step 
                      ? 'bg-primary text-primary-foreground' 
                      : s === step 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-0.5 ${s < step ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </CardContent>
    </Card>
  );
}