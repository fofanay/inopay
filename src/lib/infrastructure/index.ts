/**
 * INOPAY INFRASTRUCTURE LAYER
 * Point d'entrée unique pour toutes les configurations d'infrastructure
 */

export {
  getConfig,
  hasRequiredKeys,
  isSecureEnvironment,
  secureLog,
  performStartupCheck,
  getPublicEnvInfo,
  type InfraConfig,
  type InfraMode,
} from './config-manager';

export {
  cleanFileContent,
  cleanDOMSignatures,
  startDOMCleaner,
  stopDOMCleaner,
  auditDependencies,
  cleanPackageJson,
  SIGNATURE_PATTERNS,
  PROPRIETARY_DEPS,
} from '../security-cleaner';

export {
  storeSensitive,
  getSensitive,
  removeSensitive,
  clearAllSensitive,
  enableIncognitoMode,
  disableIncognitoMode,
  isIncognitoModeActive,
} from '../incognito-mode';
