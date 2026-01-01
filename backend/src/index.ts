import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Routes
import { cleanCodeRouter } from './routes/clean-code';
import { generateArchiveRouter } from './routes/generate-archive';
import { deployFtpRouter } from './routes/deploy-ftp';
import { exportGithubRouter } from './routes/export-github';
import { stripeWebhookRouter } from './routes/stripe-webhook';
import { checkSubscriptionRouter } from './routes/check-subscription';
import { createCheckoutRouter } from './routes/create-checkout';
import { healthRouter } from './routes/health';
import { liberateRouter } from './routes/liberate';

// Security middleware
import { 
  apiLimiter, 
  authLimiter, 
  paymentLimiter, 
  deployLimiter, 
  aiLimiter,
  bruteForceProtection,
  suspiciousRequestLogger 
} from './middleware/rateLimiter';
import { sanitizeInputs, injectionProtection } from './middleware/inputValidator';

// Configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy pour obtenir les vraies IPs derrière un reverse proxy
app.set('trust proxy', 1);

// Middleware de sécurité de base
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://izqveyvcebolrqpqlmho.supabase.co"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuré
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
}));

// Logging
app.use(morgan('combined'));

// Détection des requêtes suspectes (avant le parsing)
app.use(suspiciousRequestLogger);

// Parser JSON (sauf pour les webhooks Stripe qui ont besoin du body brut)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe-webhook') {
    next();
  } else {
    express.json({ limit: '50mb' })(req, res, next);
  }
});

// Sanitisation et protection contre les injections
app.use(sanitizeInputs);
app.use(injectionProtection);

// Protection brute-force globale
app.use(bruteForceProtection());

// Rate limiting par endpoint
app.use('/api/clean-code', aiLimiter, cleanCodeRouter);
app.use('/api/generate-archive', aiLimiter, generateArchiveRouter);
app.use('/api/deploy-ftp', deployLimiter, deployFtpRouter);
app.use('/api/export-github', deployLimiter, exportGithubRouter);
app.use('/api/stripe-webhook', stripeWebhookRouter); // Pas de rate limit pour les webhooks
app.use('/api/check-subscription', apiLimiter, checkSubscriptionRouter);
app.use('/api/create-checkout', paymentLimiter, createCheckoutRouter);
app.use('/api/liberate', aiLimiter, liberateRouter);
app.use('/health', healthRouter);

// Gestion des erreurs globale
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Inopay Backend running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
