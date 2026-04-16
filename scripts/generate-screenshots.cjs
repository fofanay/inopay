const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');

const CHROME = '/root/.cache/puppeteer/chrome/linux-147.0.7727.56/chrome-linux64/chrome';
const ANDROID = { width: 1080, height: 1920 };
const IOS     = { width: 1290, height: 2796 };

// ── Shared UI helpers ────────────────────────────────────────────────────────
const statusBar = (light = false) => `
  <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 24px 0;font-size:14px;font-weight:700;color:${light ? '#fff' : '#0F4C3A'}">
    <span>9:41</span>
    <span style="display:flex;gap:6px;align-items:center">
      <svg width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="currentColor" opacity=".4"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="currentColor" opacity=".6"/><rect x="9" y="0" width="3" height="12" rx="1" fill="currentColor" opacity=".8"/><rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="currentColor"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2C5.5 2 3.3 3 1.7 4.7L0 3C2.1 1.1 4.9 0 8 0s5.9 1.1 8 3l-1.7 1.7C12.7 3 10.5 2 8 2z" fill="currentColor" opacity=".4"/><path d="M8 5c-1.5 0-2.9.6-3.9 1.6L2.4 5C3.8 3.7 5.8 3 8 3s4.2.7 5.6 2l-1.7 1.6C10.9 5.6 9.5 5 8 5z" fill="currentColor" opacity=".7"/><path d="M8 8c-.8 0-1.6.3-2.1.9L8 12l2.1-3.1C9.6 8.3 8.8 8 8 8z" fill="currentColor"/></svg>
      <span>🔋</span>
    </span>
  </div>`;

const homeIndicator = `<div style="height:34px;display:flex;align-items:center;justify-content:center;background:inherit"><div style="width:134px;height:5px;border-radius:3px;background:rgba(0,0,0,0.2)"></div></div>`;

const bottomNav = (active) => {
  const tabs = [
    { id:'home', icon:'🏠', label:'Accueil' },
    { id:'markets', icon:'📈', label:'Marchés' },
    { id:'portfolio', icon:'💼', label:'Portef.' },
    { id:'orders', icon:'📋', label:'Ordres' },
    { id:'profile', icon:'👤', label:'Profil' },
  ];
  return `<div style="background:#fff;border-top:1px solid #f0f0f0;display:flex;padding:8px 0 0">
    ${tabs.map(t => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding-bottom:4px">
      <span style="font-size:22px;filter:${t.id===active?'none':'grayscale(1) opacity(0.4)'}">${t.icon}</span>
      <span style="font-size:11px;font-weight:${t.id===active?'700':'500'};color:${t.id===active?'#0F4C3A':'#aaa'}">${t.label}</span>
    </div>`).join('')}
  </div>`;
};

const sparkline = (color='#0F4C3A') => {
  const pts = [40,55,42,68,58,72,65,80,70,88,75,90];
  const max=Math.max(...pts), min=Math.min(...pts);
  const h=50, w=120;
  const coords = pts.map((v,i)=>`${i*(w/(pts.length-1))},${h-(v-min)/(max-min)*h}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">
    <polyline points="${coords}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
};

// ── Screens ──────────────────────────────────────────────────────────────────
const SCREENS = [

  // 1 — Login
  { name: '1-login', html: `
    <div style="height:100%;background:linear-gradient(170deg,#0F4C3A 55%,#1a6b50 100%);display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      ${statusBar(true)}
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px">
        <div style="margin-bottom:8px">
          <span style="font-size:52px;font-weight:900;color:#fff;letter-spacing:-2px">INOPAY</span>
        </div>
        <div style="color:rgba(255,255,255,0.65);font-size:18px;margin-bottom:56px;letter-spacing:0.5px">Investir en Afrique</div>
        <div style="background:#fff;border-radius:28px;padding:36px 32px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.2)">
          <div style="font-size:26px;font-weight:800;color:#111;margin-bottom:28px">Connexion</div>
          <div style="font-size:13px;color:#666;margin-bottom:6px;font-weight:600">Adresse email</div>
          <div style="background:#f4f6f8;border-radius:14px;padding:18px 20px;margin-bottom:16px;font-size:16px;color:#bbb">moussa@example.com</div>
          <div style="font-size:13px;color:#666;margin-bottom:6px;font-weight:600">Mot de passe</div>
          <div style="background:#f4f6f8;border-radius:14px;padding:18px 20px;margin-bottom:28px;font-size:16px;color:#bbb">••••••••</div>
          <div style="background:#0F4C3A;border-radius:16px;padding:18px;text-align:center;color:#fff;font-weight:800;font-size:17px;letter-spacing:0.3px">Se connecter</div>
          <div style="text-align:center;color:#aaa;font-size:14px;margin-top:20px">Pas encore de compte ? <span style="color:#0F4C3A;font-weight:700">S'inscrire</span></div>
        </div>
      </div>
      ${homeIndicator}
    </div>` },

  // 2 — Register
  { name: '2-register', html: `
    <div style="height:100%;background:linear-gradient(170deg,#0F4C3A 45%,#1a6b50 100%);display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      ${statusBar(true)}
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 40px">
        <div style="color:#fff;font-size:28px;font-weight:900;margin-bottom:4px">Créer un compte</div>
        <div style="color:rgba(255,255,255,0.6);font-size:15px;margin-bottom:36px">Commencez à investir dès aujourd'hui</div>
        <div style="background:#fff;border-radius:28px;padding:32px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.2)">
          ${[['Prénom','Moussa'],['Nom','Fofana'],['Email','moussa@example.com'],['Mot de passe','••••••••']].map(([l,ph],i)=>`
          <div style="font-size:13px;color:#666;margin-bottom:5px;font-weight:600">${l}</div>
          <div style="background:#f4f6f8;border-radius:14px;padding:16px 20px;margin-bottom:14px;font-size:16px;color:${i<2?'#222':'#bbb'}">${ph}</div>`).join('')}
          <div style="background:#0F4C3A;border-radius:16px;padding:18px;text-align:center;color:#fff;font-weight:800;font-size:17px;margin-top:4px">Créer mon compte</div>
          <div style="text-align:center;color:#aaa;font-size:14px;margin-top:18px">Déjà un compte ? <span style="color:#0F4C3A;font-weight:700">Connexion</span></div>
        </div>
      </div>
      ${homeIndicator}
    </div>` },

  // 3 — Dashboard / Home
  { name: '3-dashboard', html: `
    <div style="height:100%;background:#f0f4f2;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="background:#0F4C3A">
        ${statusBar(true)}
        <div style="padding:12px 28px 28px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div>
              <div style="color:rgba(255,255,255,0.65);font-size:14px">Bonjour, Moussa 👋</div>
              <div style="color:rgba(255,255,255,0.65);font-size:13px;margin-top:2px">Portefeuille total</div>
              <div style="font-size:38px;font-weight:900;color:#fff;margin-top:4px;letter-spacing:-1px">2 450 000 <span style="font-size:18px">FCFA</span></div>
              <div style="color:#4ade80;font-size:14px;font-weight:700;margin-top:4px">▲ +78 400 FCFA &nbsp;+3,2%</div>
            </div>
            <div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff">MF</div>
          </div>
          <div style="display:flex;gap:10px">
            ${['📈 Acheter','📉 Vendre','💳 Dépôt','📤 Retrait'].map(l=>`<div style="flex:1;background:rgba(255,255,255,0.15);border-radius:14px;padding:12px 4px;text-align:center;font-size:12px;color:#fff;font-weight:600">${l}</div>`).join('')}
          </div>
        </div>
      </div>
      <div style="flex:1;overflow:hidden;padding:20px 24px 0;display:flex;flex-direction:column;gap:0">
        <div style="font-weight:800;font-size:16px;color:#111;margin-bottom:12px">Mes positions</div>
        ${[['SONATEL','10 actions','225 000 FCFA','+12,5%',true],['ECOBANK CI','25 actions','243 750 FCFA','+8,2%',true],['ORANGE CI','15 actions','168 000 FCFA','-2,1%',false],['NSIA BANK','30 actions','204 000 FCFA','+5,7%',true]].map(([n,q,v,p,up])=>`
        <div style="background:#fff;border-radius:18px;padding:16px 20px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:42px;height:42px;background:#f0fdf4;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#0F4C3A">${n.slice(0,2)}</div>
            <div><div style="font-weight:700;font-size:14px">${n}</div><div style="color:#999;font-size:12px">${q}</div></div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;font-size:14px">${v}</div>
            <div style="color:${up?'#16a34a':'#dc2626'};font-size:12px;font-weight:700">${up?'▲':'▼'} ${p}</div>
          </div>
        </div>`).join('')}
      </div>
      ${bottomNav('home')}
      ${homeIndicator}
    </div>` },

  // 4 — Markets
  { name: '4-markets', html: `
    <div style="height:100%;background:#f0f4f2;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="background:#0F4C3A">
        ${statusBar(true)}
        <div style="padding:8px 28px 24px">
          <div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:14px">Marchés</div>
          <div style="display:flex;gap:8px;margin-bottom:14px">
            ${['BRVM','BVMAC','GSE'].map((m,i)=>`<div style="background:${i===0?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.08)'};border:1.5px solid rgba(255,255,255,${i===0?'0.5':'0.2'});border-radius:20px;padding:7px 20px;font-size:13px;font-weight:700;color:#fff">${m}</div>`).join('')}
          </div>
          <div style="background:rgba(255,255,255,0.12);border-radius:14px;padding:13px 16px;font-size:14px;color:rgba(255,255,255,0.6)">🔍 Rechercher un titre...</div>
        </div>
      </div>
      <div style="padding:16px 24px;overflow:hidden;flex:1">
        <div style="font-weight:800;font-size:15px;margin-bottom:12px">Top performers</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
          ${[['SONATEL','22 500','+2,1%',true],['NSIA BANK','6 800','+3,5%',true],['ECOBANK','9 750','+1,8%',true],['CORIS BANK','7 200','+4,2%',true]].map(([n,p,c,up])=>`
          <div style="background:#fff;border-radius:18px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="font-weight:800;font-size:13px;color:#111">${n}</div>
              <div style="font-size:11px;font-weight:700;color:${up?'#16a34a':'#dc2626'};background:${up?'#dcfce7':'#fee2e2'};padding:3px 7px;border-radius:8px">${c}</div>
            </div>
            <div style="font-size:20px;font-weight:900;color:#111;margin:8px 0 6px">${p}</div>
            ${sparkline(up?'#16a34a':'#dc2626')}
          </div>`).join('')}
        </div>
        <div style="font-weight:800;font-size:15px;margin-bottom:10px">Tous les titres BRVM</div>
        ${[['ORANGE CI','11 200','-0,3%',false],['SAFCA','2 100','+0,9%',true],['SOLIBRA','130 000','+1,4%',true]].map(([n,p,c,up])=>`
        <div style="background:#fff;border-radius:16px;padding:14px 18px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
          <div><div style="font-weight:700;font-size:14px">${n}</div><div style="color:#999;font-size:12px">BRVM</div></div>
          <div style="text-align:right">
            <div style="font-weight:800;font-size:14px">${p} FCFA</div>
            <div style="color:${up?'#16a34a':'#dc2626'};font-size:12px;font-weight:700">${up?'▲':'▼'} ${c}</div>
          </div>
        </div>`).join('')}
      </div>
      ${bottomNav('markets')}
      ${homeIndicator}
    </div>` },

  // 5 — Portfolio
  { name: '5-portfolio', html: `
    <div style="height:100%;background:#f0f4f2;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="background:#0F4C3A">
        ${statusBar(true)}
        <div style="padding:8px 28px 28px">
          <div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:4px">Portefeuille</div>
          <div style="font-size:40px;font-weight:900;color:#fff;letter-spacing:-1px;margin:8px 0">2 450 000 <span style="font-size:20px">FCFA</span></div>
          <div style="color:#4ade80;font-size:14px;font-weight:700">▲ +78 400 FCFA &nbsp;(+3,2% ce mois)</div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <div style="background:rgba(255,255,255,0.25);border-radius:20px;padding:7px 20px;font-size:13px;font-weight:700;color:#fff">Positions</div>
            <div style="background:rgba(255,255,255,0.08);border-radius:20px;padding:7px 20px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7)">Transactions</div>
            <div style="background:rgba(255,255,255,0.08);border-radius:20px;padding:7px 20px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7)">Performance</div>
          </div>
        </div>
      </div>
      <div style="flex:1;padding:16px 24px;overflow:hidden">
        ${[['SONATEL','10 actions','225 000','247 500','+10,0%',true],['ECOBANK CI','25 actions','243 750','263 750','+8,2%',true],['ORANGE CI','15 actions','168 000','164 400','-2,1%',false],['NSIA BANK','30 actions','204 000','215 700','+5,7%',true],['CORIS BANK','20 actions','144 000','156 000','+8,3%',true]].map(([n,q,v,cur,p,up])=>`
        <div style="background:#fff;border-radius:18px;padding:16px 20px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:44px;height:44px;background:#f0fdf4;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#0F4C3A">${n.slice(0,3)}</div>
              <div><div style="font-weight:800;font-size:14px">${n}</div><div style="color:#999;font-size:12px">${q}</div></div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:800;font-size:14px">${cur} FCFA</div>
              <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end">
                <span style="font-size:11px;color:#999">${v}</span>
                <span style="font-size:12px;font-weight:700;color:${up?'#16a34a':'#dc2626'}">${up?'▲':'▼'} ${p}</span>
              </div>
            </div>
          </div>
        </div>`).join('')}
      </div>
      ${bottomNav('portfolio')}
      ${homeIndicator}
    </div>` },

  // 6 — Orders (Passer un ordre)
  { name: '6-orders', html: `
    <div style="height:100%;background:#f0f4f2;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="background:#0F4C3A">
        ${statusBar(true)}
        <div style="padding:8px 28px 24px">
          <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:2px">SONATEL — BRVM</div>
          <div style="font-size:34px;font-weight:900;color:#fff;letter-spacing:-1px">22 500 FCFA</div>
          <div style="color:#4ade80;font-size:14px;font-weight:700;margin-top:4px">▲ +475 FCFA &nbsp;(+2,1%)</div>
          <div style="margin-top:14px">${sparkline('#4ade80')}</div>
        </div>
      </div>
      <div style="background:#fff;flex:1;border-radius:28px 28px 0 0;margin-top:-14px;padding:24px 28px">
        <div style="display:flex;gap:10px;margin-bottom:24px">
          <div style="flex:1;background:#0F4C3A;border-radius:14px;padding:14px;text-align:center;color:#fff;font-weight:800;font-size:15px">Acheter</div>
          <div style="flex:1;background:#f4f6f8;border-radius:14px;padding:14px;text-align:center;color:#888;font-weight:700;font-size:15px">Vendre</div>
        </div>
        <div style="font-size:13px;color:#999;font-weight:600;margin-bottom:10px">Quantité</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
          <div style="width:52px;height:52px;background:#f0f4f2;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;color:#0F4C3A;font-weight:700">−</div>
          <div style="flex:1;text-align:center;font-size:48px;font-weight:900;color:#111">10</div>
          <div style="width:52px;height:52px;background:#0F4C3A;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;font-weight:700">+</div>
        </div>
        <div style="background:#f9fbfa;border-radius:18px;padding:18px;margin-bottom:22px">
          ${[['Sous-total','225 000 FCFA'],['Commission BRVM (0,5%)','1 125 FCFA'],['Frais INOPAY (0,1%)','225 FCFA']].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:14px;border-bottom:1px solid #f0f0f0"><span style="color:#666">${l}</span><span style="font-weight:700">${v}</span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:10px 0 0;font-size:16px"><span style="font-weight:800;color:#0F4C3A">Total</span><span style="font-weight:900;color:#0F4C3A">226 350 FCFA</span></div>
        </div>
        <div style="background:#0F4C3A;border-radius:16px;padding:18px;text-align:center;color:#fff;font-weight:800;font-size:17px">Confirmer l'achat — 226 350 FCFA</div>
      </div>
      ${bottomNav('orders')}
      ${homeIndicator}
    </div>` },

  // 7 — Profile
  { name: '7-profile', html: `
    <div style="height:100%;background:#f0f4f2;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="background:#0F4C3A">
        ${statusBar(true)}
        <div style="padding:8px 28px 36px;text-align:center">
          <div style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.2);border:3px solid rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin:0 auto 12px">MF</div>
          <div style="font-size:20px;font-weight:900;color:#fff">Moussa Fofana</div>
          <div style="color:rgba(255,255,255,0.65);font-size:14px;margin-top:4px">moussa@example.com</div>
          <div style="display:inline-block;background:#4ade80;border-radius:20px;padding:5px 16px;font-size:12px;font-weight:800;color:#0F4C3A;margin-top:10px">✓ KYC Vérifié</div>
        </div>
      </div>
      <div style="background:#fff;flex:1;border-radius:28px 28px 0 0;margin-top:-18px;padding:24px 28px;overflow:hidden">
        <div style="background:#f0fdf4;border-radius:18px;padding:16px 20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-size:12px;color:#666;font-weight:600">Plan actuel</div><div style="font-size:18px;font-weight:900;color:#0F4C3A">Investor</div></div>
          <div style="background:#0F4C3A;border-radius:12px;padding:8px 16px;color:#fff;font-size:13px;font-weight:700">Changer</div>
        </div>
        ${[['👤','Mon profil','Informations personnelles'],['🔔','Notifications','Alertes et rappels'],['💳','Moyens de paiement','Cartes et mobile money'],['🔒','Sécurité','Mot de passe, 2FA'],['📄','Documents KYC','Pièces vérifiées'],['❓','Aide & Support','Centre d\'aide'],['🚪','Se déconnecter','']].map(([icon,label,sub])=>`
        <div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #f5f5f5">
          <div style="width:40px;height:40px;background:#f4f6f8;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px">${icon}</div>
          <div style="flex:1"><div style="font-weight:700;font-size:14px">${label}</div>${sub?`<div style="font-size:12px;color:#aaa">${sub}</div>`:''}</div>
          <span style="color:#ccc;font-size:18px">›</span>
        </div>`).join('')}
      </div>
      ${bottomNav('profile')}
      ${homeIndicator}
    </div>` },

  // 8 — Notifications
  { name: '8-notifications', html: `
    <div style="height:100%;background:#f0f4f2;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="background:#0F4C3A">
        ${statusBar(true)}
        <div style="padding:8px 28px 24px;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:24px;font-weight:900;color:#fff">Notifications</div>
          <div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:6px 14px;font-size:12px;color:#fff;font-weight:600">Tout lire</div>
        </div>
      </div>
      <div style="flex:1;padding:16px 24px;overflow:hidden">
        ${[
          ['🟢','Ordre exécuté','Achat de 10 SONATEL à 22 500 FCFA','Il y a 2 min',true],
          ['📈','Alerte cours','NSIA BANK +4,2% — objectif atteint','Il y a 15 min',true],
          ['💰','Dépôt confirmé','50 000 FCFA crédités sur votre compte','Il y a 1h',true],
          ['📋','Ordre en attente','Achat 5 ECOBANK à 9 500 FCFA','Il y a 3h',false],
          ['🔔','Dividende','SONATEL verse 850 FCFA/action','Hier',false],
          ['📊','Rapport mensuel','Votre bilan de mars 2025 est disponible','Il y a 2j',false],
          ['✅','KYC approuvé','Votre compte est pleinement vérifié','Il y a 5j',false],
        ].map(([icon,title,body,time,unread])=>`
        <div style="background:${unread?'#fff':'#f9fbfa'};border-radius:18px;padding:16px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;box-shadow:${unread?'0 2px 10px rgba(15,76,58,0.08)':'none'}">
          <div style="width:44px;height:44px;background:${unread?'#f0fdf4':'#f4f6f8'};border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${icon}</div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="font-weight:${unread?'800':'600'};font-size:14px;color:#111">${title}</div>
              ${unread?'<div style="width:8px;height:8px;background:#0F4C3A;border-radius:50%;flex-shrink:0;margin-top:4px"></div>':''}
            </div>
            <div style="color:#777;font-size:13px;margin-top:3px">${body}</div>
            <div style="color:#bbb;font-size:11px;margin-top:6px">${time}</div>
          </div>
        </div>`).join('')}
      </div>
      ${bottomNav('home')}
      ${homeIndicator}
    </div>` },

];

// ── Runner ────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
    headless: true,
  });
  const page = await browser.newPage();
  fs.mkdirSync('screenshots/android', { recursive: true });
  fs.mkdirSync('screenshots/ios',     { recursive: true });

  for (const s of SCREENS) {
    for (const [size, folder] of [[ANDROID,'android'],[IOS,'ios']]) {
      await page.setViewport({ ...size, deviceScaleFactor: 1 });
      const uri = 'data:text/html;charset=utf-8,' + encodeURIComponent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${size.width}px;height:${size.height}px;overflow:hidden;background:#0F4C3A}</style></head><body style="width:${size.width}px;height:${size.height}px">${s.html}</body></html>`
      );
      await page.goto(uri, { waitUntil: 'networkidle0' });
      const out = `screenshots/${folder}/${s.name}.png`;
      await page.screenshot({ path: out });
      console.log('✓', out);
    }
  }

  await browser.close();
  execSync('cd screenshots && zip -r ../google-play-screenshots.zip android/ && zip -r ../app-store-screenshots.zip ios/');
  console.log('\n✅ google-play-screenshots.zip');
  console.log('✅ app-store-screenshots.zip');
})();
