import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'device_id';

/**
 * Generates a cryptographically secure UUID v4
 */
const generateSecureUUID = async (): Promise<string> => {
  // Generate 16 random bytes
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  
  // Convert to hex string
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Format as UUID v4
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16), // Version 4
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20), // Variant
    hex.slice(20, 32)
  ].join('-');
};

/**
 * Gets the device ID from storage or generates a new one
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
  try {
    // Check if device ID already exists
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate new secure device ID
      deviceId = await generateSecureUUID();
      
      // Store it persistently
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      
      console.log('Generated new device ID:', deviceId.substring(0, 8) + '...');
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error managing device ID:', error);
    // Fallback to a simple UUID if crypto fails
    const fallbackId = `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, fallbackId);
    return fallbackId;
  }
};

/**
 * Clears the device ID (useful for testing or account reset)
 */
export const clearDeviceId = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
    console.log('Device ID cleared');
  } catch (error) {
    console.error('Error clearing device ID:', error);
  }
};

/**
 * Validates a device ID format
 */
export const isValidDeviceId = (deviceId: string): boolean => {
  // UUID v4 format validation
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(deviceId) || deviceId.startsWith('fallback-');
};