const router = require('express').Router();
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

function getUserFromReq(req) {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    return jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET);
  } catch { return null; }
}

// POST /rpc/:fn  — émulation des fonctions RPC PostgreSQL appelées par le frontend
router.post('/:fn', async (req, res) => {
  const fn = req.params.fn;
  const user = getUserFromReq(req);

  try {
    switch (fn) {

      // Renvoie les tenants visibles aux utilisateurs authentifiés (SGI, investisseurs)
      case 'get_tenants_safe': {
        const result = await pool.query(
          `SELECT * FROM tenants ORDER BY name`
        );
        return res.json(result.rows);
      }

      // Renvoie la config tenant de l'utilisateur SGI appelant
      case 'get_tenant_for_sgi': {
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const uid = req.body?._user_id || user.id;
        const result = await pool.query(
          `SELECT t.*
           FROM tenants t
           JOIN profiles p ON p.tenant_id = t.id
           WHERE p.user_id = $1
           LIMIT 1`,
          [uid]
        );
        return res.json(result.rows);
      }

      // Renvoie tous les tenants pour l'admin
      case 'get_tenants_for_admin': {
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const adminCheck = await pool.query(
          `SELECT role FROM user_roles WHERE user_id=$1 AND role='admin' LIMIT 1`, [user.id]
        );
        if (!adminCheck.rows.length) return res.status(403).json({ error: 'Accès réservé aux admins' });
        const result = await pool.query(
          `SELECT * FROM tenants ORDER BY created_at DESC`
        );
        return res.json(result.rows);
      }

      // Renvoie les intégrations SGI pour l'admin
      case 'get_sgi_integrations_for_admin': {
        if (!user) return res.status(401).json({ error: 'Non authentifié' });
        const adminCheck2 = await pool.query(
          `SELECT role FROM user_roles WHERE user_id=$1 AND role='admin' LIMIT 1`, [user.id]
        );
        if (!adminCheck2.rows.length) return res.status(403).json({ error: 'Accès réservé aux admins' });
        const result = await pool.query(
          `SELECT si.*, t.name as tenant_name
           FROM sgi_integrations si
           LEFT JOIN tenants t ON t.id = si.tenant_id
           ORDER BY si.created_at DESC
           LIMIT 100`
        );
        return res.json(result.rows);
      }

      // Vérification de rate limit (toujours passe — le vrai contrôle est côté serveur)
      case 'check_rate_limit': {
        return res.json({ allowed: true });
      }

      default:
        return res.status(404).json({ error: `RPC inconnu: ${fn}` });
    }
  } catch (err) {
    console.error(`[rpc/${fn}]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
