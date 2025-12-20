import { Router, Response } from 'express';
import { Client } from 'basic-ftp';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const deployFtpRouter = Router();

interface FTPCredentials {
  host: string;
  username: string;
  password: string;
  port?: number;
  protocol: 'ftp' | 'sftp';
  remotePath?: string;
}

function detectProvider(host: string): string {
  const hostLower = host.toLowerCase();
  if (hostLower.includes('ionos')) return 'IONOS';
  if (hostLower.includes('greengeeks')) return 'GreenGeeks';
  if (hostLower.includes('hostgator')) return 'HostGator';
  if (hostLower.includes('ovh')) return 'OVH';
  if (hostLower.includes('o2switch')) return 'o2switch';
  if (hostLower.includes('hostinger')) return 'Hostinger';
  if (hostLower.includes('bluehost')) return 'Bluehost';
  return 'votre hébergeur';
}

deployFtpRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const client = new Client();
  
  try {
    const { credentials, files } = req.body as {
      credentials: FTPCredentials;
      files: { path: string; content: string }[];
    };

    console.log('[DEPLOY-FTP] Starting deployment', {
      filesCount: files?.length || 0,
      host: credentials?.host ? `${credentials.host.substring(0, 3)}***` : 'missing',
    });

    if (!credentials.host || !credentials.username || !credentials.password) {
      return res.status(400).json({ error: 'Informations de connexion incomplètes' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier à déployer' });
    }

    // Connect to FTP
    await client.access({
      host: credentials.host,
      user: credentials.username,
      password: credentials.password,
      port: credentials.port || 21,
      secure: credentials.protocol === 'sftp',
    });

    const remotePath = credentials.remotePath || '/public_html';
    
    // Navigate to remote path
    try {
      await client.ensureDir(remotePath);
    } catch {
      console.log('[DEPLOY-FTP] Remote path already exists or created');
    }

    // Upload files
    const uploadResults: { file: string; success: boolean }[] = [];
    
    for (const file of files) {
      try {
        const buffer = Buffer.from(file.content, 'utf-8');
        const filePath = `${remotePath}/${file.path}`;
        
        // Ensure directory exists
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        if (dir) {
          await client.ensureDir(dir);
        }
        
        await client.uploadFrom(buffer as any, filePath);
        uploadResults.push({ file: file.path, success: true });
      } catch (err) {
        console.error(`[DEPLOY-FTP] Failed to upload ${file.path}:`, err);
        uploadResults.push({ file: file.path, success: false });
      }
    }

    const provider = detectProvider(credentials.host);

    res.json({
      success: true,
      message: `Déploiement réussi sur ${credentials.host}`,
      provider,
      filesUploaded: uploadResults.filter(r => r.success).length,
      files: uploadResults,
      deployedAt: new Date().toISOString(),
      remotePath,
    });
  } catch (error) {
    console.error('[DEPLOY-FTP] Deployment error:', error);
    res.status(500).json({
      error: 'Erreur lors du déploiement',
      details: 'Vérifiez vos identifiants et réessayez.',
    });
  } finally {
    client.close();
  }
});
