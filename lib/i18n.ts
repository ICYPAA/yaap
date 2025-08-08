// Temporary fallback implementation until dependencies are resolved
// TODO: Install expo-localization and i18n-js packages

// Simple fallback translation system
const translations = {
  en: {
    "language_picker.title": "Select Language",
    "service_icons.asl": "ASL",
    "service_icons.spanish": "Spanish",
    "service_icons.french": "French",
    "service_icons.hmong": "Hmong",
    "service_icons.somali": "Somali",
    "service_icons.hybrid": "Hybrid",
    "service_icons.childcare": "Childcare",
    "service_icons.wheelchair": "Wheelchair"
  },
  es: {
    "language_picker.title": "Seleccionar idioma",
    "service_icons.asl": "ASL",
    "service_icons.spanish": "Español",
    "service_icons.french": "Francés",
    "service_icons.hmong": "Hmong",
    "service_icons.somali": "Somalí",
    "service_icons.hybrid": "Híbrido",
    "service_icons.childcare": "Cuidado infantil",
    "service_icons.wheelchair": "Silla de ruedas"
  },
  so: {
    "language_picker.title": "Dooro Luqadda",
    "service_icons.asl": "ASL",
    "service_icons.spanish": "Isbaanish",
    "service_icons.french": "Faransiis",
    "service_icons.hmong": "Hmong",
    "service_icons.somali": "Soomaali",
    "service_icons.hybrid": "Isku-dhaf",
    "service_icons.childcare": "Daryeelka carruurta",
    "service_icons.wheelchair": "Kursi-gariir"
  },
  hmn: {
    "language_picker.title": "Xaiv Hom Lus",
    "service_icons.asl": "ASL",
    "service_icons.spanish": "Spanish",
    "service_icons.french": "Fab Kis",
    "service_icons.hmong": "Hmoob",
    "service_icons.somali": "Somali",
    "service_icons.hybrid": "Hybrid",
    "service_icons.childcare": "Kev saib xyuas menyuam",
    "service_icons.wheelchair": "Lub rooj zaum log"
  }
}

// Simple i18n implementation
class SimpleI18n {
  locale: string = "en"
  fallbackLocale: string = "en"

  constructor() {
    // Default to English
    this.locale = "en"
  }

  t(key: string, options?: Record<string, any>): string {
    const localeTranslations =
      translations[this.locale as keyof typeof translations]
    const fallbackTranslations =
      translations[this.fallbackLocale as keyof typeof translations]

    let result =
      localeTranslations?.[key as keyof typeof localeTranslations] ||
      fallbackTranslations?.[key as keyof typeof fallbackTranslations] ||
      key

    // Simple string interpolation if options provided
    if (options && typeof result === "string") {
      Object.keys(options).forEach((optKey) => {
        result = result.replace(
          new RegExp(`{{${optKey}}}`, "g"),
          options[optKey]
        )
      })
    }

    return result
  }
}

const i18n = new SimpleI18n()

// Storage key for user's preferred language
const STORAGE_KEY = "user_preferred_language"

// Initialize i18n (simplified version)
export const initializeI18n = async () => {
  try {
    // For now, just default to English
    i18n.locale = "en"
    return "en"
  } catch (error) {
    console.error("Error initializing i18n:", error)
    return "en"
  }
}

// Get available locales
export const getAvailableLocales = () => {
  return [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "so", name: "Soomaali" },
    { code: "hmn", name: "Hmong" }
  ]
}

// Set locale
export const setLocale = async (locale: string) => {
  try {
    if (translations[locale as keyof typeof translations]) {
      i18n.locale = locale
      // TODO: Save to AsyncStorage when available
      return true
    }
    return false
  } catch (error) {
    console.error("Error setting locale:", error)
    return false
  }
}

// Get current locale
export const getCurrentLocale = () => {
  return i18n.locale
}

export default i18n
