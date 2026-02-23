import AsyncStorage from "@react-native-async-storage/async-storage"

// Storage keys
const KEYS = {
  DEBUG_MODE: "icypaa_debug_mode",
  THEME_MODE: "icypaa_theme_mode"
}

// Debug mode storage functions
export const getDebugMode = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(KEYS.DEBUG_MODE)
    return value === "true"
  } catch (error) {
    console.error("Error reading debug mode from storage:", error)
    return false
  }
}

export const setDebugMode = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.DEBUG_MODE, enabled ? "true" : "false")
  } catch (error) {
    console.error("Error saving debug mode to storage:", error)
  }
}

// Theme mode storage functions
export const getThemeMode = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(KEYS.THEME_MODE)
  } catch (error) {
    console.error("Error reading theme mode from storage:", error)
    return null
  }
}

export const setThemeMode = async (mode: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEYS.THEME_MODE, mode)
  } catch (error) {
    console.error("Error saving theme mode to storage:", error)
  }
}
