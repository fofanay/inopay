import { Router, Request, Response } from 'express';
import archiver from 'archiver';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const generateArchiveRouter = Router();

const DOCKERFILE_CONTENT = `# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;

const NGINX_CONF = `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;

const README_CONTENT = `# 🚀 Projet Autonome - Guide d'Installation

Ce projet a été nettoyé et libéré de toute dépendance propriétaire.

## 📋 Prérequis

- Node.js 18+ (recommandé: 20 LTS)
- npm ou yarn
- Docker (optionnel)

## 🛠️ Installation

\`\`\`bash
npm install
npm run dev
\`\`\`

## 🐳 Docker

\`\`\`bash
docker build -t mon-app .
docker run -p 80:80 mon-app
\`\`\`

---

**Généré par Inopay** - Libérez votre code !
`;

generateArchiveRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectName, cleanedFiles } = req.body;

    if (!cleanedFiles || Object.keys(cleanedFiles).length === 0) {
      return res.status(400).json({ error: 'Données de projet invalides' });
    }

    console.log(`Generating archive for project with ${Object.keys(cleanedFiles).length} files`);

    // Set response headers for ZIP download
    const fileName = `${projectName || 'project'}_cleaned_${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Create archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Add cleaned files
    for (const [filePath, content] of Object.entries(cleanedFiles)) {
      archive.append(content as string, { name: filePath });
    }

    // Add deployment files
    archive.append(DOCKERFILE_CONTENT, { name: 'Dockerfile' });
    archive.append(NGINX_CONF, { name: 'nginx.conf' });
    archive.append(README_CONTENT, { name: 'README_INOPAY.md' });

    await archive.finalize();
  } catch (error) {
    console.error('Error generating archive:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erreur interne' 
    });
  }
});
