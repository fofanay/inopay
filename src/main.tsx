import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { 
  performIntegrityCheck, 
  performStartupCheck, 
  secureLog,
  cleanDOMSignatures,
  startDOMCleaner,
} from "./infrastructure";

// ============= INOPAY SOVEREIGN STARTUP =============

// 1. Vérification d'intégrité (domaine autorisé)
const integrityResult = performIntegrityCheck();

if (!integrityResult.authorized) {
  secureLog('error', 'Intégrité compromise', {
    domain: integrityResult.domain,
    message: integrityResult.message,
  });
  
  if (integrityResult.shouldAlert) {
    // En production, masquer les fonctionnalités sensibles
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;">
        <div style="text-align:center;">
          <h1>⚠️ Accès non autorisé</h1>
          <p>Ce domaine n'est pas autorisé à exécuter cette application.</p>
          <p>Contactez l'administrateur.</p>
        </div>
      </div>
    `;
    throw new Error('Domaine non autorisé');
  }
}

// 2. Vérification de configuration au démarrage
const startupResult = performStartupCheck();

if (!startupResult.healthy) {
  secureLog('warn', 'Configuration incomplète', {
    mode: startupResult.mode,
    warnings: startupResult.warnings,
    errors: startupResult.errors,
  });
}

// Log le mode d'infrastructure (sans données sensibles)
secureLog('log', `Infrastructure: ${startupResult.mode} mode`);

// 3. Nettoyage DOM des signatures de plateforme (production uniquement)
if (import.meta.env.PROD) {
  // Nettoyage initial au chargement du DOM
  document.addEventListener('DOMContentLoaded', () => {
    const removed = cleanDOMSignatures();
    if (removed > 0) {
      secureLog('log', `Nettoyé ${removed} signatures du DOM`);
    }
  });
  
  // Observer les nouveaux éléments pour nettoyage continu
  startDOMCleaner();
  
  // Nettoyage supplémentaire après le rendu React
  requestAnimationFrame(() => {
    cleanDOMSignatures();
  });
}

// 4. Rendu de l'application
createRoot(document.getElementById("root")!).render(<App />);
