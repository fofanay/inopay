/**
 * INOPAY INFRASTRUCTURE MODULE
 * ============================
 * Point d'entrée unique pour l'infrastructure souveraine.
 * 
 * Usage:
 *   import { getInfraConfig, secureLog } from '@/infrastructure';
 *   import infra from '@/infrastructure';
 * 
 * © 2024 Inovaq Canada Inc. - Code 100% Souverain
 */

export * from './adapter';
export { default as infra } from './adapter';

// Re-export DOM cleaner utilities
export { 
  cleanDOMSignatures, 
  startDOMCleaner, 
  stopDOMCleaner,
  cleanFileContent,
  auditDependencies,
} from '../lib/security-cleaner';

// Re-export incognito mode utilities  
export {
  enableIncognitoMode,
  disableIncognitoMode,
  isIncognitoModeActive,
  storeSensitive,
  getSensitive,
  removeSensitive,
  clearAllSensitive,
  hasSensitiveData,
  useSensitiveStorage,
} from '../lib/incognito-mode';

// Re-export sovereignty report utilities
export {
  generateSovereigntyReport,
  checkFileForProprietaryCode,
  auditProjectFiles,
  generateReportSummary,
} from '../lib/sovereigntyReport';
