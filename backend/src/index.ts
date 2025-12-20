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

// Configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(morgan('combined'));

// Parser JSON (sauf pour les webhooks Stripe qui ont besoin du body brut)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe-webhook') {
    next();
  } else {
    express.json({ limit: '50mb' })(req, res, next);
  }
});

// Routes
app.use('/api/clean-code', cleanCodeRouter);
app.use('/api/generate-archive', generateArchiveRouter);
app.use('/api/deploy-ftp', deployFtpRouter);
app.use('/api/export-github', exportGithubRouter);
app.use('/api/stripe-webhook', stripeWebhookRouter);
app.use('/api/check-subscription', checkSubscriptionRouter);
app.use('/api/create-checkout', createCheckoutRouter);
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
