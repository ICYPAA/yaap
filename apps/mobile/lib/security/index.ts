/**
 * Security module exports
 * Centralized security utilities for the ICYPAA app
 */

// Device ID management
export { 
  getOrCreateDeviceId, 
  clearDeviceId, 
  isValidDeviceId 
} from './deviceId';

// Input sanitization
export {
  sanitizeInput,
  sanitizeProfileData,
  sanitizeName,
  sanitizeLastInitial,
  sanitizeImageData,
  sanitizeUrl,
  sanitizeSearchQuery,
  isValidEmail,
  escapeHtml,
  sanitizePhoneNumber,
  safeJsonParse
} from './sanitization';

// Rate limiting
export {
  getRateLimiter,
  withRateLimit,
  useRateLimit,
  RateLimitError
} from './rateLimiter';

// Session management
export {
  getSessionManager,
  useSession
} from './session';

// App integrity
export {
  getIntegrityChecker,
  checkAppIntegrity,
  useAppIntegrity
} from './integrity';

// Security monitoring
export {
  getSecurityMonitor,
  logSecurityEvent,
  useSecurityMonitor,
  SecurityEventType
} from './monitoring';