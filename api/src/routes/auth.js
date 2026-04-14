const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendMail } = require('../utils/mailer');

// POST /auth/register
router.post('/register', async (req, res) => {
  const { email, password, name, country } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 caracteres minimum)' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const hash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at`,
      [email.toLowerCase().trim(), hash, name || null]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO profiles (user_id, email, full_name, country, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING`,
      [user.id, user.email, name || null, country || null]
    );

    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'user') ON CONFLICT DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO kycs (user_id, status, created_at) VALUES ($1, 'EN_ATTENTE', NOW()) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO user_types (user_id, type) VALUES ($1, 'investor') ON CONFLICT DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO sandbox_balances (user_id, balance, created_at, updated_at) VALUES ($1, 10000000, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO investor_scores (user_id, score, status, kyc_completed, account_activity, investment_intent, created_at, updated_at) VALUES ($1, 0, 'new', false, 0, 0, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO ai_onboarding_actions (user_id, step, status, message_content, created_at) VALUES ($1, 'registered', 'completed', 'Compte cree avec profil, KYC, sandbox et score investisseur', NOW())`,
      [user.id]
    );

    await client.query('COMMIT');

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    _sendWelcomeEmail(user.email, name, user.id).catch(err => console.error('[register] welcome-email error:', err.message));

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at, role: 'user', user_type: 'investor' },
      token,
      accessToken: token,
      profile: { full_name: name || null, country: country || null, role: 'user', user_type: 'investor' },
      role: 'user',
      user_type: 'investor',
      onboarding: { step_actuel: 'kyc', kyc_status: 'EN_ATTENTE', sandbox_balance: 10000000, progression: 10 }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email deja utilise' });
    console.error('[register]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

async function _sendWelcomeEmail(email, fullName, userId) {
  const firstName = (fullName || '').split(' ')[0] || 'Investisseur';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}.container{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden}.header{background:#0F4C3A;padding:32px;text-align:center}.header h1{color:#fff;margin:0;font-size:22px}.body{padding:32px}.cta{display:block;background:#0F4C3A;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;text-align:center;font-weight:bold;margin:24px 0}.feature{display:flex;align-items:flex-start;gap:12px;margin:12px 0;font-size:14px}.steps{background:#f9f9f9;border-radius:8px;padding:20px;margin:20px 0}.step{display:flex;align-items:center;gap:12px;margin:8px 0;font-size:14px}.step-num{background:#0F4C3A;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;flex-shrink:0}.footer{background:#f9f9f9;padding:20px 32px;font-size:12px;color:#888;text-align:center}</style></head><body><div class="container"><div class="header"><h1>Bienvenue sur INOPAY, ` + firstName + ` !</h1><p style="color:#a0d4b8;margin:8px 0 0;font-size:14px">Votre portail d investissement africain</p></div><div class="body"><p>Vous rejoignez la plateforme d investissement sur les marches boursiers africains. Votre espace sandbox est pret avec <strong>10 000 000 FCFA virtuels</strong>.</p><div class="steps"><p style="margin:0 0 12px;font-weight:bold;color:#0F4C3A">Vos 3 etapes pour commencer :</p><div class="step"><div class="step-num">1</div><span><strong>Completez votre KYC</strong> - Verification d identite pour les investissements reels</span></div><div class="step"><div class="step-num">2</div><span><strong>Explorez le sandbox</strong> - Entrainez-vous avec 10M FCFA virtuels</span></div><div class="step"><div class="step-num">3</div><span><strong>Choisissez votre plan</strong> - Acces aux fonctionnalites premium et recommandations IA</span></div></div><div class="feature"><span>BRVM</span><div>Bourse Regionale des Valeurs Mobilieres (8 pays UEMOA)</div></div><div class="feature"><span>BVMAC</span><div>Bourse des Valeurs de l Afrique Centrale (CEMAC)</div></div><div class="feature"><span>GSE</span><div>Ghana Stock Exchange</div></div><div class="feature"><span>IA</span><div>DeepSeek - Recommandations personnalisees et analyse de portefeuille</div></div><a href="https://getinopay.com/dashboard" class="cta">Acceder a mon tableau de bord</a><p style="color:#666;font-size:14px">Des questions ? <a href="mailto:contact@getinopay.com">contact@getinopay.com</a></p></div><div class="footer"><p>INOPAY - Investir en Afrique, depuis partout dans le monde</p><p>2026 INOPAY Group. Tous droits reserves.</p></div></div></body></html>`;

  await sendMail({ to: email, subject: `Bienvenue sur INOPAY, ${firstName} !`, html, from: 'INOPAY <noreply@getinopay.com>' });
  await db.query(`INSERT INTO email_logs (user_id, email, template, status, sent_at) VALUES ($1, $2, 'welcome', 'sent', NOW())`, [userId, email]).catch(() => {});
}

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Identifiants incorrects' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

    const [profileRes, roleRes, kycRes, typeRes] = await Promise.all([
      db.query(`SELECT full_name, phone, country, tenant_id FROM profiles WHERE user_id=$1`, [user.id]).catch(() => ({ rows: [] })),
      db.query(`SELECT role FROM user_roles WHERE user_id=$1 ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END LIMIT 1`, [user.id]).catch(() => ({ rows: [] })),
      db.query(`SELECT status FROM kycs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user.id]).catch(() => ({ rows: [] })),
      db.query(`SELECT type FROM user_types WHERE user_id=$1 LIMIT 1`, [user.id]).catch(() => ({ rows: [] }))
    ]);

    const profile = profileRes.rows[0] || {};
    const role = roleRes.rows[0] && roleRes.rows[0].role || 'user';
    const kycStatus = kycRes.rows[0] && kycRes.rows[0].status || 'EN_ATTENTE';
    const userType = typeRes.rows[0] && typeRes.rows[0].type || 'investor';

    await db.query('UPDATE users SET last_sign_in_at=NOW() WHERE id=$1', [user.id]).catch(() => {});

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role, user_type: userType },
      token, accessToken: token,
      profile: { full_name: profile.full_name || user.name, phone: profile.phone, country: profile.country, tenant_id: profile.tenant_id, role, user_type: userType },
      kyc_status: kycStatus,
      role,
      user_type: userType
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/signin', (req, res, next) => { req.url = '/login'; router.handle(req, res, next); });
router.post('/signup', (req, res, next) => { req.url = '/register'; router.handle(req, res, next); });

// GET /auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.created_at, u.last_sign_in_at, p.full_name, p.phone, p.country, p.tenant_id FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const [roleRes, kycRes, typeRes] = await Promise.all([
      db.query(`SELECT role FROM user_roles WHERE user_id=$1 ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END LIMIT 1`, [req.user.id]).catch(() => ({ rows: [] })),
      db.query(`SELECT status FROM kycs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [req.user.id]).catch(() => ({ rows: [] })),
      db.query(`SELECT type FROM user_types WHERE user_id=$1 LIMIT 1`, [req.user.id]).catch(() => ({ rows: [] }))
    ]);

    const role = roleRes.rows[0] && roleRes.rows[0].role || 'user';
    const userType = typeRes.rows[0] && typeRes.rows[0].type || 'investor';
    const kycStatus = kycRes.rows[0] && kycRes.rows[0].status || 'EN_ATTENTE';
    const user = result.rows[0];
    res.json({
      user: {
        ...user,
        role,
        user_type: userType,
        kyc_status: kycStatus,
        user_metadata: { full_name: user.full_name, phone: user.phone, country: user.country, role, user_type: userType }
      },
      role,
      user_type: userType
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /auth/onboarding-status
router.get('/onboarding-status', require('../middleware/auth'), async (req, res) => {
  try {
    const userId = req.user.id;
    const [profileRes, kycRes, sandboxRes, subRes] = await Promise.all([
      db.query(`SELECT full_name, phone, country FROM profiles WHERE user_id=$1`, [userId]).catch(() => ({ rows: [] })),
      db.query(`SELECT status, id_document_url, selfie_url, proof_of_residence_url FROM kycs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
      db.query(`SELECT balance FROM sandbox_balances WHERE user_id=$1`, [userId]).catch(() => ({ rows: [] })),
      db.query(`SELECT status FROM subscriptions WHERE user_id=$1 AND status='active' ORDER BY created_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] }))
    ]);

    const profile = profileRes.rows[0] || {};
    const kyc = kycRes.rows[0] || {};
    const sandbox = sandboxRes.rows[0] || {};
    const hasSub = subRes.rows.length > 0;
    const kycStatus = kyc.status || 'EN_ATTENTE';
    const profilComplet = !!(profile.full_name && profile.phone && profile.country);
    const kycSoumis = ['SOUMIS', 'EN_REVISION', 'VALIDE'].includes(kycStatus);
    const kycValide = kycStatus === 'VALIDE';
    const kycDocuments = !!(kyc.id_document_url && kyc.selfie_url);

    let progression = 10;
    if (profilComplet) progression += 15;
    if (kycDocuments) progression += 15;
    if (kycSoumis) progression += 25;
    if (kycValide) progression += 20;
    if (hasSub) progression += 15;
    progression = Math.min(100, progression);

    let stepActuel = 'profil';
    if (profilComplet && !kycValide) stepActuel = 'kyc';
    if (kycValide && !hasSub) stepActuel = 'subscription';
    if (kycValide && hasSub) stepActuel = 'complet';

    res.json({
      step_actuel: stepActuel,
      profil_complete: profilComplet,
      kyc_status: kycStatus,
      kyc_documents_uploaded: kycDocuments,
      sandbox_balance: parseInt(sandbox.balance) || 10000000,
      has_subscription: hasSub,
      progression,
      details: {
        profil: { complete: profilComplet, manquants: [!profile.full_name && 'full_name', !profile.phone && 'phone', !profile.country && 'country'].filter(Boolean) },
        kyc: { status: kycStatus, documents: { id_document: !!kyc.id_document_url, selfie: !!kyc.selfie_url, proof_of_residence: !!kyc.proof_of_residence_url } },
        subscription: { active: hasSub }
      }
    });
  } catch (err) {
    console.error('[onboarding-status]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /auth/update
router.patch('/update', require('../middleware/auth'), async (req, res) => {
  try {
    const { full_name, phone, country } = req.body;
    await db.query(
      `UPDATE profiles SET full_name=COALESCE($1,full_name), phone=COALESCE($2,phone), country=COALESCE($3,country), updated_at=NOW() WHERE user_id=$4`,
      [full_name, phone, country, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });
    const result = await db.query('SELECT id, name FROM users WHERE email=$1', [email.toLowerCase().trim()]);
    if (result.rows.length) {
      const user = result.rows[0];
      const token = require('crypto').randomBytes(32).toString('hex');
      await db.query(`UPDATE users SET reset_token=$1, reset_token_expires=NOW()+INTERVAL '1 hour' WHERE id=$2`, [token, user.id]).catch(() => {});
      const resetUrl = `https://getinopay.com/auth/reset?token=${token}`;
      const firstName = (user.name || '').split(' ')[0] || 'Investisseur';
      await sendMail({
        to: email,
        subject: 'Reinitialisation de votre mot de passe - INOPAY',
        from: 'INOPAY <noreply@getinopay.com>',
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#0F4C3A">Bonjour ${firstName},</h2><p>Vous avez demande une reinitialisation de mot de passe.</p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0F4C3A;color:#fff;border-radius:8px;text-decoration:none;margin-top:16px">Reinitialiser mon mot de passe</a><p style="font-size:12px;color:#999;margin-top:24px">Ce lien expire dans 1 heure.</p></div>`
      }).catch(() => {});
    }
    res.json({ success: true, message: 'Si cet email existe, un lien a ete envoye.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /auth/rpc/:fn
router.post('/rpc/:fn', require('../middleware/auth'), async (req, res) => {
  try {
    const { fn } = req.params;
    if (fn === 'get_user_tenant_id') {
      const result = await db.query('SELECT tenant_id FROM profiles WHERE user_id=$1', [req.body._user_id || req.user.id]);
      return res.json({ data: result.rows[0] && result.rows[0].tenant_id || null });
    }
    res.status(404).json({ error: `RPC ${fn} non implemente` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
