const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCREENS = [
  {
    name: '1-login',
    html: `<div style="background:#0F4C3A;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;font-family:-apple-system,sans-serif">
      <div style="font-size:48px;font-weight:900;color:#fff;letter-spacing:-2px;margin-bottom:8px">INOPAY</div>
      <div style="color:rgba(255,255,255,0.6);font-size:16px;margin-bottom:60px">Investissez sur la BRVM</div>
      <div style="background:#fff;border-radius:24px;padding:32px;width:100%;max-width:360px">
        <h2 style="color:#111;font-size:22px;font-weight:800;margin:0 0 24px">Connexion</h2>
        <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin-bottom:12px;font-size:15px;color:#999">Email</div>
        <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin-bottom:24px;font-size:15px;color:#999">Mot de passe</div>
        <div style="background:#0F4C3A;border-radius:12px;padding:16px;text-align:center;color:#fff;font-weight:700;font-size:16px">Se connecter</div>
        <p style="text-align:center;color:#999;font-size:13px;margin-top:16px">Pas de compte ? <span style="color:#0F4C3A;font-weight:600">S'inscrire</span></p>
      </div>
    </div>`
  },
  {
    name: '2-dashboard',
    html: `<div style="background:#f4f7f5;height:100%;font-family:-apple-system,sans-serif;overflow:hidden">
      <div style="background:#0F4C3A;padding:50px 20px 32px;color:#fff">
        <div style="font-size:13px;opacity:0.7;margin-bottom:4px">Bonjour, Fofana</div>
        <div style="font-size:13px;opacity:0.7">Portefeuille total</div>
        <div style="font-size:40px;font-weight:900;margin:4px 0">2 450 000 <span style="font-size:20px">FCFA</span></div>
        <div style="color:#4ade80;font-size:14px">▲ +3,2% ce mois</div>
      </div>
      <div style="background:#fff;border-radius:24px 24px 0 0;margin-top:-16px;padding:20px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          ${['📈 Acheter','📉 Vendre','💼 Portefeuille','📋 Ordres'].map(l=>`<div style="background:#f0fdf4;border-radius:14px;padding:16px;text-align:center;font-weight:600;font-size:14px;color:#0F4C3A">${l}</div>`).join('')}
        </div>
        <div style="font-weight:700;font-size:15px;margin-bottom:12px">Mes positions</div>
        ${[['SONATEL','22 500 FCFA','▲ +2,1%'],['ECOBANK CI','9 750 FCFA','▲ +0,8%'],['ORANGE CI','11 200 FCFA','▼ -0,3%']].map(([n,p,c])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0f0f0">
          <div><div style="font-weight:600;font-size:14px">${n}</div><div style="color:#999;font-size:12px">10 actions</div></div>
          <div style="text-align:right"><div style="font-weight:700;font-size:14px">${p}</div><div style="color:${c.includes('▲')?'#16a34a':'#dc2626'};font-size:12px">${c}</div></div>
        </div>`).join('')}
      </div>
    </div>`
  },
  {
    name: '3-markets',
    html: `<div style="background:#f4f7f5;height:100%;font-family:-apple-system,sans-serif">
      <div style="background:#0F4C3A;padding:50px 20px 24px;color:#fff">
        <div style="font-size:22px;font-weight:800">Marchés</div>
        <div style="display:flex;gap:8px;margin-top:16px">
          ${['BRVM','BVMAC','GSE'].map((m,i)=>`<div style="background:${i===0?'rgba(255,255,255,0.2)':'transparent'};border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:6px 16px;font-size:13px;font-weight:600">${m}</div>`).join('')}
        </div>
      </div>
      <div style="background:#fff;border-radius:24px 24px 0 0;margin-top:-12px;padding:20px">
        <div style="background:#f5f5f5;border-radius:12px;padding:12px 16px;margin-bottom:16px;color:#999;font-size:14px">🔍 Rechercher un titre...</div>
        <div style="font-weight:700;font-size:14px;margin-bottom:12px">Top movers</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          ${[['SONATEL','22 500','+2,1%'],['ECOBANK','9 750','+1,8%'],['ORANGE CI','11 200','-0,3%'],['NSIA BANK','6 800','+3,5%']].map(([n,p,c])=>`
          <div style="background:#f9fafb;border-radius:14px;padding:12px">
            <div style="font-weight:700;font-size:13px">${n}</div>
            <div style="font-size:16px;font-weight:800;margin:4px 0">${p}</div>
            <div style="color:${c.includes('+')?'#16a34a':'#dc2626'};font-size:12px;font-weight:600">${c}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`
  },
  {
    name: '4-order',
    html: `<div style="background:#f4f7f5;height:100%;font-family:-apple-system,sans-serif">
      <div style="background:#0F4C3A;padding:50px 20px 24px;color:#fff">
        <div style="font-size:11px;opacity:0.7;margin-bottom:4px">SONATEL</div>
        <div style="font-size:28px;font-weight:900">22 500 FCFA</div>
        <div style="color:#4ade80;font-size:13px">▲ +2,1% aujourd'hui</div>
      </div>
      <div style="background:#fff;border-radius:24px 24px 0 0;margin-top:-12px;padding:20px">
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <div style="flex:1;background:#0F4C3A;border-radius:12px;padding:12px;text-align:center;color:#fff;font-weight:700">Acheter</div>
          <div style="flex:1;background:#f5f5f5;border-radius:12px;padding:12px;text-align:center;color:#666;font-weight:700">Vendre</div>
        </div>
        <div style="font-size:13px;color:#999;margin-bottom:8px">Quantité</div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="width:44px;height:44px;background:#f0fdf4;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;color:#0F4C3A;font-weight:700">−</div>
          <div style="flex:1;text-align:center;font-size:32px;font-weight:900">10</div>
          <div style="width:44px;height:44px;background:#0F4C3A;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-weight:700">+</div>
        </div>
        <div style="background:#f9fafb;border-radius:16px;padding:16px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px"><span style="color:#666">Sous-total</span><span style="font-weight:600">225 000 FCFA</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px"><span style="color:#666">Frais (0,6%)</span><span style="font-weight:600">1 350 FCFA</span></div>
          <div style="display:flex;justify-content:space-between;font-size:15px;color:#0F4C3A"><span style="font-weight:700">Total</span><span style="font-weight:900">226 350 FCFA</span></div>
        </div>
        <div style="background:#0F4C3A;border-radius:14px;padding:16px;text-align:center;color:#fff;font-weight:700;font-size:16px">Confirmer l'achat — 226 350 FCFA</div>
      </div>
    </div>`
  },
  {
    name: '5-portfolio',
    html: `<div style="background:#f4f7f5;height:100%;font-family:-apple-system,sans-serif">
      <div style="background:#0F4C3A;padding:50px 20px 24px;color:#fff">
        <div style="font-size:22px;font-weight:800">Portefeuille</div>
        <div style="font-size:36px;font-weight:900;margin:8px 0">2 450 000 FCFA</div>
        <div style="color:#4ade80;font-size:14px">▲ +78 400 FCFA (+3,2%)</div>
      </div>
      <div style="background:#fff;border-radius:24px 24px 0 0;margin-top:-12px;padding:20px">
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <div style="background:#0F4C3A;color:#fff;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:600">Positions</div>
          <div style="background:#f5f5f5;border-radius:20px;padding:6px 16px;font-size:13px;color:#666">Transactions</div>
        </div>
        ${[['SONATEL','10 actions','225 000 FCFA','▲ +12,5%','#16a34a'],['ECOBANK CI','25 actions','243 750 FCFA','▲ +8,2%','#16a34a'],['ORANGE CI','15 actions','168 000 FCFA','▼ -2,1%','#dc2626'],['NSIA BANK','30 actions','204 000 FCFA','▲ +5,7%','#16a34a']].map(([n,q,v,p,c])=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #f0f0f0">
          <div><div style="font-weight:700;font-size:14px">${n}</div><div style="color:#999;font-size:12px">${q}</div></div>
          <div style="text-align:right"><div style="font-weight:700">${v}</div><div style="color:${c};font-size:12px">${p}</div></div>
        </div>`).join('')}
      </div>
    </div>`
  },
  {
    name: '6-kyc',
    html: `<div style="background:#f4f7f5;height:100%;font-family:-apple-system,sans-serif">
      <div style="background:#0F4C3A;padding:50px 20px 24px;color:#fff">
        <div style="font-size:22px;font-weight:800">Vérification KYC</div>
        <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px">Étape 1 sur 3 — Informations personnelles</div>
      </div>
      <div style="background:#fff;border-radius:24px 24px 0 0;margin-top:-12px;padding:20px">
        <div style="display:flex;gap:6px;margin-bottom:24px">
          ${[1,2,3].map((s,i)=>`<div style="flex:1;height:4px;border-radius:2px;background:${i===0?'#0F4C3A':'#e5e7eb'}"></div>`).join('')}
        </div>
        ${['Prénom','Nom de famille','Date de naissance','Nationalité','Numéro de téléphone'].map((f,i)=>`
        <div style="margin-bottom:14px">
          <div style="font-size:12px;color:#666;margin-bottom:4px">${f}</div>
          <div style="background:#f8f9fa;border:1.5px solid ${i<2?'#0F4C3A':'#e5e7eb'};border-radius:12px;padding:14px;font-size:14px;color:${i<2?'#111':'#bbb'}">${i===0?'Moussa':i===1?'Fofana':''}</div>
        </div>`).join('')}
        <div style="background:#0F4C3A;border-radius:14px;padding:16px;text-align:center;color:#fff;font-weight:700;margin-top:8px">Continuer →</div>
      </div>
    </div>`
  },
  {
    name: '7-payment',
    html: `<div style="background:#f4f7f5;height:100%;font-family:-apple-system,sans-serif">
      <div style="background:#0F4C3A;padding:50px 20px 24px;color:#fff">
        <div style="font-size:22px;font-weight:800">Paiement</div>
        <div style="color:rgba(255,255,255,0.7);font-size:13px">SONATEL</div>
      </div>
      <div style="background:#fff;border-radius:24px 24px 0 0;margin-top:-12px;padding:20px">
        <div style="background:#f9fafb;border-radius:16px;padding:16px;margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:10px">Récapitulatif</div>
          ${[['Titre','SONATEL'],['Quantité','10 actions'],['Prix unitaire','22 500 FCFA'],['Sous-total','225 000 FCFA'],['Frais (0,6%)','1 350 FCFA']].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f0f0f0"><span style="color:#666">${l}</span><span style="font-weight:600">${v}</span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;padding:8px 0;color:#0F4C3A;font-weight:800">Total<span>226 350 FCFA</span></div>
        </div>
        <div style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;margin-bottom:10px">Mode de paiement</div>
        ${[['🌍','CinetPay','Orange Money, MTN, Wave…',true],['🇬🇭','Paystack','Carte, Mobile Money Ghana',false]].map(([i,n,d,s])=>`
        <div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;border:2px solid ${s?'#0F4C3A':'#e5e7eb'};background:${s?'#f0fdf4':'#fff'};margin-bottom:10px">
          <span style="font-size:24px">${i}</span>
          <div style="flex:1"><div style="font-weight:700;font-size:13px">${n}</div><div style="font-size:11px;color:#999">${d}</div></div>
          <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${s?'#0F4C3A':'#ccc'};display:flex;align-items:center;justify-content:center">${s?'<div style="width:8px;height:8px;border-radius:50%;background:#0F4C3A"></div>':''}</div>
        </div>`).join('')}
        <div style="background:#0F4C3A;border-radius:14px;padding:16px;text-align:center;color:#fff;font-weight:700;margin-top:8px">Payer 226 350 FCFA</div>
      </div>
    </div>`
  },
  {
    name: '8-profile',
    html: `<div style="background:#f4f7f5;height:100%;font-family:-apple-system,sans-serif">
      <div style="background:#0F4C3A;padding:50px 20px 40px;color:#fff;text-align:center">
        <div style="width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;margin:0 auto 12px">MF</div>
        <div style="font-size:18px;font-weight:800">Moussa Fofana</div>
        <div style="font-size:13px;opacity:0.7">moussa@inopay.app</div>
        <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:20px;padding:4px 12px;font-size:12px;margin-top:8px">KYC Vérifié ✓</div>
      </div>
      <div style="background:#fff;border-radius:24px 24px 0 0;margin-top:-16px;padding:20px">
        ${[['👤','Mon profil'],['💳','Abonnement','Investor'],['🔔','Notifications'],['💰','Moyens de paiement'],['🔒','Sécurité'],['❓','Aide & Support'],['🚪','Se déconnecter']].map(([i,l,b])=>`
        <div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #f5f5f5">
          <span style="font-size:20px">${i}</span>
          <span style="flex:1;font-weight:500;font-size:14px">${l}</span>
          ${b?`<span style="background:#f0fdf4;color:#0F4C3A;font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px">${b}</span>`:''}
          <span style="color:#ccc">›</span>
        </div>`).join('')}
      </div>
    </div>`
  }
];

const ANDROID = { width: 1080, height: 1920, scale: 1 };
const IOS     = { width: 1290, height: 2796, scale: 1 };

async function shoot(page, html, size, outPath) {
  await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: size.scale });
  const uri = 'data:text/html;charset=utf-8,' + encodeURIComponent(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:${size.width}px;height:${size.height}px;overflow:hidden}</style></head><body>${html}</body></html>`
  );
  await page.goto(uri, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, type: 'png' });
  console.log('✓', outPath);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome/linux-147.0.7727.56/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });
  const page = await browser.newPage();

  fs.mkdirSync('screenshots/android', { recursive: true });
  fs.mkdirSync('screenshots/ios', { recursive: true });

  for (const s of SCREENS) {
    await shoot(page, s.html, ANDROID, `screenshots/android/${s.name}.png`);
    await shoot(page, s.html, IOS,     `screenshots/ios/${s.name}.png`);
  }

  await browser.close();

  execSync('cd screenshots && zip -r ../google-play-screenshots.zip android/ && zip -r ../app-store-screenshots.zip ios/');
  console.log('\n✅ google-play-screenshots.zip');
  console.log('✅ app-store-screenshots.zip');
})();
