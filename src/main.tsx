import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { startDOMCleaner, cleanDOMSignatures } from "./lib/security-cleaner";
import { performStartupCheck, secureLog } from "./lib/infrastructure/config-manager";

// INOPAY: Vérification de sécurité au démarrage
const startupResult = performStartupCheck();

if (!startupResult.healthy) {
  secureLog('warn', 'Configuration incomplète', {
    mode: startupResult.mode,
    warnings: startupResult.warnings,
  });
}

// Log le mode d'infrastructure (sans données sensibles)
secureLog('log', `Mode infrastructure: ${startupResult.mode}`);

// INOPAY SOVEREIGN: Nettoyer toutes les signatures de plateformes du DOM
// Actif en production pour garantir l'anonymat du code source
if (import.meta.env.PROD) {
  document.addEventListener('DOMContentLoaded', () => {
    const removed = cleanDOMSignatures();
    if (removed > 0) {
      secureLog('log', `Nettoyé ${removed} signatures IDE du DOM`);
    }
  });
  
  // Observer les nouveaux éléments pour nettoyage continu
  startDOMCleaner();
}

createRoot(document.getElementById("root")!).render(<App />);
