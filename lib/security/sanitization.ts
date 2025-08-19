/**
 * Input sanitization utilities for security
 */

const MAX_INPUT_LENGTH = 1000;
const MAX_NAME_LENGTH = 50;
const MAX_URL_LENGTH = 2048;

/**
 * Sanitizes user input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input: string, maxLength: number = MAX_INPUT_LENGTH): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    // Remove leading/trailing whitespace
    .trim()
    // Remove HTML/script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    // Remove potentially dangerous characters
    .replace(/[<>\"'`]/g, '')
    // Limit length
    .slice(0, maxLength);
};

/**
 * Sanitizes user profile data
 */
export const sanitizeProfileData = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const sanitized: any = {};

  // Sanitize first name
  if (data.first_name) {
    sanitized.first_name = sanitizeName(data.first_name);
  }

  // Sanitize last initial
  if (data.last_initial) {
    sanitized.last_initial = sanitizeLastInitial(data.last_initial);
  }

  // Validate profile picture if present
  if (data.profile_picture) {
    sanitized.profile_picture = sanitizeImageData(data.profile_picture);
  }

  return sanitized;
};

/**
 * Sanitizes a name field
 */
export const sanitizeName = (name: string): string => {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Allow only letters, spaces, hyphens, and apostrophes
  return name
    .trim()
    .replace(/[^a-zA-Z\s\-']/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_NAME_LENGTH);
};

/**
 * Sanitizes last initial
 */
export const sanitizeLastInitial = (initial: string): string => {
  if (!initial || typeof initial !== 'string') {
    return '';
  }

  // Allow only a single letter
  const cleaned = initial.trim().replace(/[^a-zA-Z]/g, '');
  return cleaned.charAt(0).toUpperCase();
};

/**
 * Validates and sanitizes image data URL
 */
export const sanitizeImageData = (imageData: string): string | null => {
  if (!imageData || typeof imageData !== 'string') {
    return null;
  }

  // Check if it's a valid data URL for images
  const dataUrlRegex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  
  if (!dataUrlRegex.test(imageData)) {
    return null;
  }

  // Limit the size of base64 data (approximately 5MB)
  const maxBase64Length = 5 * 1024 * 1024 * 1.37; // Base64 is ~37% larger
  
  if (imageData.length > maxBase64Length) {
    console.warn('Image data too large, rejecting');
    return null;
  }

  return imageData;
};

/**
 * Sanitizes URL input
 */
export const sanitizeUrl = (url: string): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim().slice(0, MAX_URL_LENGTH);

  // Only allow http(s) and app-specific schemes
  const urlRegex = /^(https?:\/\/|yaap:\/\/|icypaa:\/\/).+/i;
  
  if (!urlRegex.test(trimmedUrl)) {
    return null;
  }

  // Additional check for common XSS patterns
  if (trimmedUrl.includes('javascript:') || 
      trimmedUrl.includes('data:') || 
      trimmedUrl.includes('vbscript:')) {
    return null;
  }

  return trimmedUrl;
};

/**
 * Sanitizes search queries
 */
export const sanitizeSearchQuery = (query: string): string => {
  if (!query || typeof query !== 'string') {
    return '';
  }

  return query
    .trim()
    // Remove special regex characters that could cause issues
    .replace(/[.*+?^${}()|[\]\\]/g, '')
    // Remove SQL-like keywords
    .replace(/\b(select|insert|update|delete|drop|union|exec|execute)\b/gi, '')
    .slice(0, 100);
};

/**
 * Validates email format (for admin login)
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Escapes HTML entities to prevent XSS
 */
export const escapeHtml = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const htmlEntities: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return text.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
};

/**
 * Validates and sanitizes phone numbers (if ever needed)
 */
export const sanitizePhoneNumber = (phone: string): string => {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Limit to reasonable phone number length
  return digitsOnly.slice(0, 15);
};

/**
 * Sanitizes JSON data before parsing
 */
export const safeJsonParse = <T = any>(jsonString: string, fallback: T): T => {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      return fallback;
    }

    // Basic validation before parsing
    if (jsonString.length > 1024 * 1024) { // 1MB limit
      console.warn('JSON string too large');
      return fallback;
    }

    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
};