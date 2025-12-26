import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { startDOMCleaner, cleanDOMSignatures } from "./lib/security-cleaner";
import { performIntegrityCheck } from "./config/sovereign-adapter";

// Vérification d'intégrité au démarrage
const integrityResult = performIntegrityCheck();
if (!integrityResult.authorized && integrityResult.shouldAlert) {
  console.warn('[INOPAY]', integrityResult.message);
}

// Activer le nettoyage DOM en production
if (import.meta.env.PROD) {
  // Nettoyer les signatures existantes
  document.addEventListener('DOMContentLoaded', () => {
    const removed = cleanDOMSignatures();
    if (removed > 0) {
      console.log(`[INOPAY] Cleaned ${removed} IDE signatures from DOM`);
    }
  });
  
  // Observer les nouveaux éléments
  startDOMCleaner();
}

createRoot(document.getElementById("root")!).render(<App />);
