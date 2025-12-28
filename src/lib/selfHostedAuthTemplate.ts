/**
 * Self-Hosted Authentication Templates
 * Generates a complete auth solution for liberated projects
 */

export interface AuthTemplateConfig {
  projectName: string;
  hasExistingUsers: boolean;
  authProvider: 'jwt-standalone' | 'supabase-selfhosted' | 'keycloak';
}

/**
 * Generate complete auth service for docker-compose
 */
export function generateAuthDockerCompose(config: AuthTemplateConfig): string {
  const { projectName, authProvider } = config;

  if (authProvider === 'supabase-selfhosted') {
    return generateSupabaseAuthCompose(projectName);
  } else if (authProvider === 'keycloak') {
    return generateKeycloakCompose(projectName);
  }

  return generateStandaloneAuthCompose(projectName);
}

function generateStandaloneAuthCompose(projectName: string): string {
  return `# ═══════════════════════════════════════════════════════════════
# SERVICE D'AUTHENTIFICATION AUTONOME
# Compatible JWT - Remplacement direct de Supabase Auth
# ═══════════════════════════════════════════════════════════════

version: '3.8'

services:
  auth-api:
    build:
      context: ./auth
      dockerfile: Dockerfile
    container_name: ${projectName}-auth
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - JWT_SECRET=\${JWT_SECRET}
      - JWT_EXPIRY=7d
      - REFRESH_TOKEN_EXPIRY=30d
      - DATABASE_URL=\${DATABASE_URL}
      - SMTP_HOST=\${SMTP_HOST:-}
      - SMTP_PORT=\${SMTP_PORT:-587}
      - SMTP_USER=\${SMTP_USER:-}
      - SMTP_PASS=\${SMTP_PASS:-}
      - FROM_EMAIL=\${FROM_EMAIL:-noreply@example.com}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  app-network:
    external: true
`;
}

function generateSupabaseAuthCompose(projectName: string): string {
  return `# ═══════════════════════════════════════════════════════════════
# SUPABASE SELF-HOSTED - Stack Authentification Complète
# Alternative directe à Supabase Cloud
# ═══════════════════════════════════════════════════════════════

version: '3.8'

services:
  # GoTrue - Service d'authentification Supabase
  auth:
    image: supabase/gotrue:v2.132.3
    container_name: ${projectName}-gotrue
    restart: unless-stopped
    ports:
      - "9999:9999"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: \${API_EXTERNAL_URL:-http://localhost:9999}
      
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: \${DATABASE_URL}
      
      GOTRUE_SITE_URL: \${SITE_URL:-http://localhost:3000}
      GOTRUE_URI_ALLOW_LIST: \${ADDITIONAL_REDIRECT_URLS:-}
      GOTRUE_DISABLE_SIGNUP: \${DISABLE_SIGNUP:-false}
      
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: \${JWT_EXPIRY:-3600}
      GOTRUE_JWT_SECRET: \${JWT_SECRET}
      
      GOTRUE_EXTERNAL_EMAIL_ENABLED: \${ENABLE_EMAIL_SIGNUP:-true}
      GOTRUE_MAILER_AUTOCONFIRM: \${ENABLE_EMAIL_AUTOCONFIRM:-false}
      GOTRUE_SMTP_HOST: \${SMTP_HOST:-}
      GOTRUE_SMTP_PORT: \${SMTP_PORT:-587}
      GOTRUE_SMTP_USER: \${SMTP_USER:-}
      GOTRUE_SMTP_PASS: \${SMTP_PASS:-}
      GOTRUE_SMTP_ADMIN_EMAIL: \${SMTP_ADMIN_EMAIL:-}
      GOTRUE_MAILER_URLPATHS_INVITE: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_RECOVERY: /auth/v1/verify
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: /auth/v1/verify
      
      GOTRUE_EXTERNAL_PHONE_ENABLED: false
      GOTRUE_SMS_AUTOCONFIRM: true
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:9999/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Kong API Gateway (optionnel - pour compatibilité complète Supabase)
  kong:
    image: kong:3.4.2
    container_name: ${projectName}-kong
    restart: unless-stopped
    ports:
      - "8000:8000"
      - "8443:8443"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl
    volumes:
      - ./kong/kong.yml:/var/lib/kong/kong.yml:ro
    networks:
      - app-network

networks:
  app-network:
    external: true
`;
}

function generateKeycloakCompose(projectName: string): string {
  return `# ═══════════════════════════════════════════════════════════════
# KEYCLOAK - Identity and Access Management
# Solution enterprise-grade pour l'authentification
# ═══════════════════════════════════════════════════════════════

version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    container_name: ${projectName}-keycloak
    restart: unless-stopped
    command: start-dev
    ports:
      - "8080:8080"
    environment:
      - KEYCLOAK_ADMIN=\${KEYCLOAK_ADMIN:-admin}
      - KEYCLOAK_ADMIN_PASSWORD=\${KEYCLOAK_ADMIN_PASSWORD}
      - KC_DB=postgres
      - KC_DB_URL=jdbc:postgresql://postgres:5432/\${POSTGRES_DB:-keycloak}
      - KC_DB_USERNAME=\${POSTGRES_USER:-keycloak}
      - KC_DB_PASSWORD=\${POSTGRES_PASSWORD}
      - KC_HOSTNAME=\${KC_HOSTNAME:-localhost}
      - KC_PROXY=edge
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  app-network:
    external: true
`;
}

/**
 * Generate standalone auth API code
 */
export function generateAuthAPICode(): { files: Record<string, string> } {
  const files: Record<string, string> = {};

  // Main auth API
  files['index.ts'] = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3001;

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());

// JWT Config
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const REFRESH_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d';

interface User {
  id: string;
  email: string;
  encrypted_password: string;
  email_confirmed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-api', timestamp: new Date().toISOString() });
});

// Sign Up
app.post('/auth/v1/signup', async (req, res) => {
  try {
    const { email, password, data } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Check if user exists
    const existing = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    
    // Create user
    await pool.query(
      \`INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), $4, NOW(), NOW())\`,
      [userId, email.toLowerCase(), hashedPassword, JSON.stringify(data || {})]
    );
    
    // Generate tokens
    const accessToken = jwt.sign(
      { sub: userId, email: email.toLowerCase(), role: 'authenticated' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    const refreshToken = jwt.sign(
      { sub: userId, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );
    
    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      user: {
        id: userId,
        email: email.toLowerCase(),
        email_confirmed_at: new Date().toISOString(),
        user_metadata: data || {}
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Sign In
app.post('/auth/v1/token', async (req, res) => {
  try {
    const { email, password, grant_type, refresh_token } = req.body;
    
    if (grant_type === 'refresh_token' && refresh_token) {
      // Refresh token flow
      try {
        const decoded = jwt.verify(refresh_token, JWT_SECRET) as { sub: string; type: string };
        
        if (decoded.type !== 'refresh') {
          return res.status(401).json({ error: 'Invalid refresh token' });
        }
        
        const userResult = await pool.query('SELECT * FROM auth.users WHERE id = $1', [decoded.sub]);
        if (userResult.rows.length === 0) {
          return res.status(401).json({ error: 'User not found' });
        }
        
        const user = userResult.rows[0];
        
        const accessToken = jwt.sign(
          { sub: user.id, email: user.email, role: 'authenticated' },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        
        const newRefreshToken = jwt.sign(
          { sub: user.id, type: 'refresh' },
          JWT_SECRET,
          { expiresIn: REFRESH_EXPIRY }
        );
        
        return res.json({
          access_token: accessToken,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: newRefreshToken,
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.raw_user_meta_data || {}
          }
        });
      } catch {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
    }
    
    // Password flow
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const result = await pool.query('SELECT * FROM auth.users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.encrypted_password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: 'authenticated' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    
    const refreshToken = jwt.sign(
      { sub: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );
    
    // Update last sign in
    await pool.query('UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = $1', [user.id]);
    
    res.json({
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        user_metadata: user.raw_user_meta_data || {}
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get User
app.get('/auth/v1/user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    
    const result = await pool.query('SELECT * FROM auth.users WHERE id = $1', [decoded.sub]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      phone: user.phone,
      created_at: user.created_at,
      updated_at: user.updated_at,
      user_metadata: user.raw_user_meta_data || {},
      app_metadata: user.raw_app_meta_data || {}
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Sign Out
app.post('/auth/v1/logout', (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // For added security, you could maintain a token blacklist in Redis
  res.json({ success: true });
});

// Password Reset Request
app.post('/auth/v1/recover', async (req, res) => {
  try {
    const { email } = req.body;
    
    const result = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email.toLowerCase()]);
    
    // Always return success to prevent email enumeration
    if (result.rows.length > 0) {
      const resetToken = jwt.sign(
        { sub: result.rows[0].id, type: 'recovery' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      // TODO: Send email with reset link
      console.log(\`Password reset requested for \${email}. Token: \${resetToken}\`);
    }
    
    res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Recovery error:', error);
    res.status(500).json({ error: 'Failed to process recovery request' });
  }
});

// Update Password
app.put('/auth/v1/user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    
    const { password, data } = req.body;
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE auth.users SET encrypted_password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, decoded.sub]
      );
    }
    
    if (data) {
      await pool.query(
        'UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(data), decoded.sub]
      );
    }
    
    const result = await pool.query('SELECT * FROM auth.users WHERE id = $1', [decoded.sub]);
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      email: user.email,
      user_metadata: user.raw_user_meta_data || {}
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.listen(PORT, () => {
  console.log(\`🔐 Auth API running on port \${PORT}\`);
});
`;

  // Package.json
  files['package.json'] = JSON.stringify({
    name: "sovereign-auth-api",
    version: "1.0.0",
    description: "Self-hosted authentication API - Supabase Auth compatible",
    main: "dist/index.js",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js"
    },
    dependencies: {
      express: "^4.18.2",
      cors: "^2.8.5",
      helmet: "^7.1.0",
      pg: "^8.11.3",
      jsonwebtoken: "^9.0.2",
      bcryptjs: "^2.4.3",
      uuid: "^9.0.0"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/cors": "^2.8.17",
      "@types/jsonwebtoken": "^9.0.5",
      "@types/bcryptjs": "^2.4.6",
      "@types/uuid": "^9.0.7",
      "@types/pg": "^8.10.9",
      tsx: "^4.7.0",
      typescript: "^5.3.0"
    }
  }, null, 2);

  // Dockerfile
  files['Dockerfile'] = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
`;

  // tsconfig
  files['tsconfig.json'] = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true
    },
    include: ["src/**/*"]
  }, null, 2);

  // Auth schema SQL
  files['schema.sql'] = `-- ═══════════════════════════════════════════════════════════════
-- SCHÉMA D'AUTHENTIFICATION SOUVERAIN
-- Compatible avec les migrations Supabase existantes
-- ═══════════════════════════════════════════════════════════════

-- Create auth schema if not exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Users table (compatible Supabase)
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255) NOT NULL,
  email_confirmed_at TIMESTAMPTZ,
  phone VARCHAR(20),
  phone_confirmed_at TIMESTAMPTZ,
  confirmation_token VARCHAR(255),
  confirmation_sent_at TIMESTAMPTZ,
  recovery_token VARCHAR(255),
  recovery_sent_at TIMESTAMPTZ,
  email_change_token VARCHAR(255),
  email_change VARCHAR(255),
  email_change_sent_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  raw_app_meta_data JSONB DEFAULT '{}',
  raw_user_meta_data JSONB DEFAULT '{}',
  is_super_admin BOOLEAN DEFAULT FALSE,
  role VARCHAR(50) DEFAULT 'authenticated',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  banned_until TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent VARCHAR(255),
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  factor_id UUID,
  aal VARCHAR(10),
  not_after TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users(email);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON auth.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions(user_id);

-- Function to get current user ID (compatible with Supabase RLS)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::UUID;
$$ LANGUAGE sql STABLE;

-- Function for getting current user role
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::json->>'role', 'anon');
$$ LANGUAGE sql STABLE;

COMMENT ON TABLE auth.users IS 'Auth: Stores user authentication data - Supabase compatible';
`;

  // User migration script
  files['migrate-users.ts'] = `/**
 * Script de migration des utilisateurs depuis Supabase
 * 
 * Usage:
 * 1. Exportez vos utilisateurs depuis Supabase (Dashboard > Auth > Users > Export)
 * 2. Placez le fichier users.json dans ce dossier
 * 3. Exécutez: npx tsx migrate-users.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';

interface SupabaseUser {
  id: string;
  email: string;
  encrypted_password: string;
  email_confirmed_at: string | null;
  phone: string | null;
  phone_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  raw_user_meta_data: Record<string, any>;
  raw_app_meta_data: Record<string, any>;
}

async function migrateUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Read exported users
    const usersData = fs.readFileSync('./users.json', 'utf-8');
    const users: SupabaseUser[] = JSON.parse(usersData);
    
    console.log(\`Found \${users.length} users to migrate\`);
    
    let migrated = 0;
    let skipped = 0;
    
    for (const user of users) {
      try {
        // Check if user already exists
        const existing = await pool.query('SELECT id FROM auth.users WHERE id = $1 OR email = $2', [user.id, user.email]);
        
        if (existing.rows.length > 0) {
          console.log(\`Skipping existing user: \${user.email}\`);
          skipped++;
          continue;
        }
        
        // Insert user
        await pool.query(\`
          INSERT INTO auth.users (
            id, email, encrypted_password, email_confirmed_at, phone, phone_confirmed_at,
            created_at, updated_at, last_sign_in_at, raw_user_meta_data, raw_app_meta_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        \`, [
          user.id,
          user.email,
          user.encrypted_password,
          user.email_confirmed_at,
          user.phone,
          user.phone_confirmed_at,
          user.created_at,
          user.updated_at,
          user.last_sign_in_at,
          JSON.stringify(user.raw_user_meta_data || {}),
          JSON.stringify(user.raw_app_meta_data || {})
        ]);
        
        console.log(\`Migrated: \${user.email}\`);
        migrated++;
      } catch (error) {
        console.error(\`Failed to migrate \${user.email}:\`, error);
      }
    }
    
    console.log(\`\\n✅ Migration complete: \${migrated} migrated, \${skipped} skipped\`);
  } finally {
    await pool.end();
  }
}

migrateUsers().catch(console.error);
`;

  return { files };
}

/**
 * Generate client-side auth adapter
 */
export function generateAuthClientAdapter(): string {
  return `/**
 * Auth Client Adapter
 * Compatible avec Supabase Auth API
 * 
 * Remplacez vos imports @supabase/supabase-js par ce client
 */

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  email_confirmed_at?: string;
  phone?: string;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: AuthUser;
}

// Configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_API_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_API_KEY || '';

// Create a Supabase-compatible client
export const supabase: SupabaseClient = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// For self-hosted auth without Supabase, use this custom client
export class SovereignAuthClient {
  private baseUrl: string;
  private session: AuthSession | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadSession();
  }

  private loadSession() {
    const stored = localStorage.getItem('auth_session');
    if (stored) {
      try {
        this.session = JSON.parse(stored);
      } catch {}
    }
  }

  private saveSession(session: AuthSession | null) {
    this.session = session;
    if (session) {
      localStorage.setItem('auth_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('auth_session');
    }
  }

  async signUp(email: string, password: string, options?: { data?: Record<string, any> }) {
    const response = await fetch(\`\${this.baseUrl}/auth/v1/signup\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: options?.data })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { data: { user: null, session: null }, error: new Error(data.error) };
    }

    const session: AuthSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      user: data.user
    };

    this.saveSession(session);
    return { data: { user: data.user, session }, error: null };
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    const response = await fetch(\`\${this.baseUrl}/auth/v1/token\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: credentials.email, 
        password: credentials.password,
        grant_type: 'password'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { data: { user: null, session: null }, error: new Error(data.error) };
    }

    const session: AuthSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      user: data.user
    };

    this.saveSession(session);
    return { data: { user: data.user, session }, error: null };
  }

  async signOut() {
    if (this.session) {
      await fetch(\`\${this.baseUrl}/auth/v1/logout\`, {
        method: 'POST',
        headers: { 
          'Authorization': \`Bearer \${this.session.access_token}\`
        }
      });
    }
    this.saveSession(null);
    return { error: null };
  }

  async getUser() {
    if (!this.session) {
      return { data: { user: null }, error: new Error('Not authenticated') };
    }

    const response = await fetch(\`\${this.baseUrl}/auth/v1/user\`, {
      headers: { 
        'Authorization': \`Bearer \${this.session.access_token}\`
      }
    });

    if (!response.ok) {
      return { data: { user: null }, error: new Error('Failed to get user') };
    }

    const user = await response.json();
    return { data: { user }, error: null };
  }

  async getSession() {
    return { data: { session: this.session }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    // Initial callback
    callback('INITIAL_SESSION', this.session);
    
    // Listen for storage changes (cross-tab sync)
    const handler = (e: StorageEvent) => {
      if (e.key === 'auth_session') {
        this.loadSession();
        callback('TOKEN_REFRESHED', this.session);
      }
    };
    
    window.addEventListener('storage', handler);
    
    return {
      data: { subscription: { unsubscribe: () => window.removeEventListener('storage', handler) } }
    };
  }

  get auth() {
    return {
      signUp: this.signUp.bind(this),
      signInWithPassword: this.signInWithPassword.bind(this),
      signOut: this.signOut.bind(this),
      getUser: this.getUser.bind(this),
      getSession: this.getSession.bind(this),
      onAuthStateChange: this.onAuthStateChange.bind(this)
    };
  }
}

// Export default based on configuration
export const auth = SUPABASE_URL.includes('supabase') 
  ? supabase.auth 
  : new SovereignAuthClient(SUPABASE_URL).auth;

export default supabase;
`;
}
