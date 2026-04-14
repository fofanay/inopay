require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
const corsOptions = {
  origin: ['https://getinopay.com','https://www.getinopay.com','https://app.getinopay.com','http://localhost:8080','http://localhost:3000'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-internal-key','apikey','x-client-info','X-API-Key'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 500, message: { error: 'Trop de requêtes.' } }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'inopay-api', version: '3.1' }));

// Auth & Upload
app.use('/auth', rateLimit({ windowMs: 15*60*1000, max: 10 }), require('./routes/auth'));
app.use('/upload', require('./routes/upload'));

// REST générique
app.use('/api', require('./routes/data'));
app.use('/data', require('./routes/data'));

// === FONCTIONS MÉTIER ===
const F = (name) => require(`./routes/functions/${name}`);

// Payments
app.use('/functions/cinetpay',                       F('cinetpay'));
app.use('/functions/cinetpay-init',                  F('cinetpay-init'));
app.use('/functions/cinetpay-subscription',          F('cinetpay-subscription'));
app.use('/functions/cinetpay-subscription-webhook',  F('cinetpay-subscription-webhook'));
app.use('/functions/cinetpay-sgi-subscription',      F('cinetpay-sgi-subscription'));
app.use('/functions/cinetpay-sgi-subscription-webhook', F('cinetpay-sgi-subscription-webhook'));
app.use('/functions/cinetpay-webhook',               F('cinetpay-webhook'));
app.use('/functions/paystack',                       F('paystack'));
app.use('/functions/paystack-init',                  F('paystack-init'));
app.use('/functions/paystack-create-subaccount',     F('paystack-create-subaccount'));
app.use('/functions/paystack-webhook',               F('paystack-webhook'));
app.use('/functions/billing-webhook',                F('billing-webhook'));
app.use('/functions/billing-generate-invoices',      F('billing-generate-invoices'));
app.use('/functions/billing-agent',                  F('billing-agent'));
app.use('/functions/billing-charge',                 F('billing-charge'));
app.use('/functions/billing-subscriptions',          F('billing-subscriptions'));

// Email & Communication
app.use('/functions/send-email',                     F('send-email'));
app.use('/functions/welcome-email',                  F('welcome-email'));
app.use('/functions/auth-email-hook',                F('auth-email-hook'));
app.use('/functions/behavioral-email',               F('behavioral-email'));
app.use('/functions/email-sequence',                 F('email-sequence'));
app.use('/functions/process-email-queue',            F('process-email-queue'));
app.use('/functions/email-optimization-agent',       F('email-optimization-agent'));

// KYC
app.use('/functions/kyc-secure',                     F('kyc-secure'));
app.use('/functions/kyc-ai-validate',                F('kyc-ai-validate'));

// Notifications & Chat
app.use('/functions/notification-agent',             F('notification-agent'));
app.use('/functions/fofy-chat',                      F('fofy-chat'));
app.use('/functions/fofy-agent',                     F('fofy-agent'));
app.use('/functions/partnership-notification',       F('partnership-notification'));

// Market data
app.use('/functions/sync-market-data',               F('sync-market-data'));
app.use('/functions/sync-bond-issuances',            F('sync-bond-issuances'));
app.use('/functions/sync-order-status',              F('sync-order-status'));
app.use('/functions/sync-gala-contacts',             F('sync-gala-contacts'));
app.use('/functions/financial-calendar-agent',       F('financial-calendar-agent'));
app.use('/functions/brvm-news-agent',                F('brvm-news-agent'));

// AI Agents
app.use('/functions/recommendation-agent',           F('recommendation-agent'));
app.use('/functions/portfolio-agent',                F('portfolio-agent'));
app.use('/functions/risk-fraud-agent',               F('risk-fraud-agent'));
app.use('/functions/trust-agent',                    F('trust-agent'));
app.use('/functions/prospect-agents',                F('prospect-agents'));
app.use('/functions/prospect-discovery-agent',       F('prospect-discovery-agent'));
app.use('/functions/prospect-enrichment-agent',      F('prospect-enrichment-agent'));
app.use('/functions/prospect-email-agent',           F('prospect-email-agent'));
app.use('/functions/prospect-followup-agent',        F('prospect-followup-agent'));
app.use('/functions/prospect-contact-enrichment',    F('prospect-contact-enrichment'));
app.use('/functions/analytics-agent',                F('analytics-agent'));
app.use('/functions/financial-control-agent',        F('financial-control-agent'));
app.use('/functions/investor-agents',                F('investor-agents'));
app.use('/functions/investor-lead-activation',       F('investor-lead-activation'));
app.use('/functions/investor-funnel-agent',          F('investor-funnel-agent'));
app.use('/functions/investor-qualification-agent',   F('investor-qualification-agent'));
app.use('/functions/agent-system',                   F('agent-system'));
app.use('/functions/agent-memory',                   F('agent-memory'));
app.use('/functions/agent-control',                  F('agent-control'));
app.use('/functions/ai-god',                         F('ai-god'));
app.use('/functions/ai-orchestrator',                F('ai-orchestrator'));
app.use('/functions/ai-agent',                       F('ai-agent'));
app.use('/functions/ai-diaspora',                    F('ai-diaspora'));
app.use('/functions/ai-sgi',                         F('ai-sgi'));
app.use('/functions/ai-revenue',                     F('ai-revenue'));
app.use('/functions/authority-agent',                F('authority-agent'));
app.use('/functions/google-authority-agent',         F('google-authority-agent'));
app.use('/functions/growth-engine-agent',            F('growth-engine-agent'));
app.use('/functions/disaster-recovery-agent',        F('disaster-recovery-agent'));
app.use('/functions/embeddings',                     F('embeddings'));
app.use('/functions/qdrant-init',                    F('qdrant-init'));
app.use('/functions/event-reactor',                  F('event-reactor'));
app.use('/functions/press-agent',                    F('press-agent'));
app.use('/functions/reply-analysis-agent',           F('reply-analysis-agent'));
app.use('/functions/meeting-booking-agent',          F('meeting-booking-agent'));
app.use('/functions/partnership-acquisition-agent',  F('partnership-acquisition-agent'));

// System
app.use('/functions/system-health',                  F('system-health'));
app.use('/functions/system-self-heal',               F('system-self-heal'));
app.use('/functions/maintenance',                    F('maintenance'));
app.use('/functions/maintenance-toggle',             F('maintenance-toggle'));
app.use('/functions/readiness-check',                F('readiness-check'));
app.use('/functions/validate-dual-core',             F('validate-dual-core'));

// SGI
app.use('/functions/sgi-api-keys',                   F('sgi-api-keys'));
app.use('/functions/sgi-subscription-renew',         F('sgi-subscription-renew'));
app.use('/functions/sgi-agents',                     F('sgi-agents'));
app.use('/functions/sgi-api-gateway',                F('sgi-api-gateway'));
app.use('/functions/sgi-outreach-agent',             F('sgi-outreach-agent'));
app.use('/functions/sgi-assignment-agent',           F('sgi-assignment-agent'));
app.use('/functions/sgi-credibility-agent',          F('sgi-credibility-agent'));
app.use('/functions/sgi-followup-agent',             F('sgi-followup-agent'));
app.use('/functions/sgi-integration-agent',          F('sgi-integration-agent'));
app.use('/functions/sgi-pilot-report',               F('sgi-pilot-report'));
app.use('/functions/sgi-sales-sequence',             F('sgi-sales-sequence'));
app.use('/functions/sgi-seed-directory',             F('sgi-seed-directory'));
app.use('/functions/sgi-discovery-agent',            F('sgi-discovery-agent'));
app.use('/functions/sgi-enrichment-agent',           F('sgi-enrichment-agent'));
app.use('/functions/sgi-match-investor',             F('sgi-match-investor'));
app.use('/functions/bond-sgi-outreach',              F('bond-sgi-outreach'));
app.use('/functions/gse-broker-discovery',           F('gse-broker-discovery'));

// Social & Growth
app.use('/functions/social',                         F('social'));
app.use('/functions/social-generate-post',           F('social-generate-post'));
app.use('/functions/social-growth-agent',            F('social-growth-agent'));
app.use('/functions/facebook-post',                  F('facebook-post'));
app.use('/functions/twitter-post',                   F('twitter-post'));
app.use('/functions/linkedin-connect',               F('linkedin-connect'));
app.use('/functions/linkedin-callback',              F('linkedin-callback'));
app.use('/functions/linkedin-post',                  F('linkedin-post'));
app.use('/functions/linkedin-growth-agent',          F('linkedin-growth-agent'));
app.use('/functions/linkedin-publisher-agent',       F('linkedin-publisher-agent'));
app.use('/functions/visual-generate',                F('visual-generate'));

// Diaspora & Partners
app.use('/functions/diaspora-unsubscribe',           F('diaspora-unsubscribe'));
app.use('/functions/diaspora-conversion-agent',      F('diaspora-conversion-agent'));

// SGI Gateway (alias court)
app.use('/sgi', F('sgi-api-gateway'));

// === ALIASES SOUS-ROUTES ===
app.post('/functions/kyc-secure/submit',             (req, res, next) => { req.url = '/submit';          F('kyc-secure')(req, res, next); });
app.get( '/functions/kyc-secure/status',             (req, res, next) => { req.url = '/status';          F('kyc-secure')(req, res, next); });
app.post('/functions/notification-agent/send',       (req, res, next) => { req.url = '/send';            F('notification-agent')(req, res, next); });
app.post('/functions/behavioral-email/cycle',        (req, res, next) => { req.url = '/cycle';           F('behavioral-email')(req, res, next); });
app.post('/functions/email-sequence/cycle',          (req, res, next) => { req.url = '/cycle';           F('email-sequence')(req, res, next); });
app.post('/functions/sgi-agents/match-investor',     (req, res, next) => { req.url = '/match-investor';  F('sgi-agents')(req, res, next); });
app.post('/functions/sgi-agents/outreach',           (req, res, next) => { req.url = '/outreach';        F('sgi-agents')(req, res, next); });
app.post('/functions/sgi-agents/discovery',          (req, res, next) => { req.url = '/discovery';       F('sgi-agents')(req, res, next); });
app.post('/functions/sgi-agents/cycle',              (req, res, next) => { req.url = '/cycle';           F('sgi-agents')(req, res, next); });
app.post('/functions/system-self-heal/cycle',        (req, res, next) => { req.url = '/cycle';           F('system-self-heal')(req, res, next); });
app.post('/functions/analytics-agent/cycle',         (req, res, next) => { req.url = '/cycle';           F('analytics-agent')(req, res, next); });
app.post('/functions/financial-control-agent/cycle', (req, res, next) => { req.url = '/cycle';           F('financial-control-agent')(req, res, next); });
app.post('/functions/billing-agent/cycle',           (req, res, next) => { req.url = '/cycle';           F('billing-agent')(req, res, next); });
app.post('/functions/billing-subscriptions/cycle',   (req, res, next) => { req.url = '/cycle';           F('billing-subscriptions')(req, res, next); });
app.get( '/functions/billing-subscriptions/status',  (req, res, next) => { req.url = '/status';          F('billing-subscriptions')(req, res, next); });
app.post('/functions/billing-subscriptions/cancel',  (req, res, next) => { req.url = '/cancel';          F('billing-subscriptions')(req, res, next); });
app.post('/functions/portfolio-agent/cycle',         (req, res, next) => { req.url = '/cycle';           F('portfolio-agent')(req, res, next); });
app.post('/functions/recommendation-agent/cycle',    (req, res, next) => { req.url = '/cycle';           F('recommendation-agent')(req, res, next); });
app.post('/functions/risk-fraud-agent/cycle',        (req, res, next) => { req.url = '/cycle';           F('risk-fraud-agent')(req, res, next); });
app.post('/functions/financial-calendar-agent/cycle',(req, res, next) => { req.url = '/cycle';           F('financial-calendar-agent')(req, res, next); });
app.post('/functions/trust-agent/cycle',             (req, res, next) => { req.url = '/cycle';           F('trust-agent')(req, res, next); });
app.post('/functions/prospect-agents/funnel',        (req, res, next) => { req.url = '/funnel';          F('prospect-agents')(req, res, next); });
app.post('/functions/investor-agents/qualification', (req, res, next) => { req.url = '/qualification';   F('investor-agents')(req, res, next); });
app.post('/functions/investor-agents/growth-engine', (req, res, next) => { req.url = '/growth-engine';   F('investor-agents')(req, res, next); });
app.post('/functions/agent-memory/memory',           (req, res, next) => { req.url = '/memory';          F('agent-system')(req, res, next); });

// RPC (émulation fonctions PostgreSQL utilisées par le frontend)
app.use('/rpc', require('./routes/rpc'));

// === 404 & ERROR HANDLER (toujours en dernier) ===
app.use((req, res) => res.status(404).json({ error: `Route introuvable: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => { console.error('[ERROR]', err.message); res.status(500).json({ error: 'Erreur interne' }); });

app.listen(process.env.PORT, () => console.log(`API Inopay v3.1 démarrée sur port ${process.env.PORT}`));
