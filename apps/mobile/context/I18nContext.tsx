import React, { createContext, useContext, useEffect, useState } from "react"
import i18n, {
  getAvailableLocales,
  getCurrentLocale,
  setLocale
} from "../lib/i18n"

interface Language {
  code: string
  name: string
}

interface I18nContextType {
  t: (key: string, options?: Record<string, any>) => string
  currentLanguage: string
  setLanguage: (langCode: string) => Promise<void>
  availableLanguages: Language[]
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>("en")

  const availableLanguages: Language[] = getAvailableLocales()

  useEffect(() => {
    // Initialize with current locale
    setCurrentLanguage(getCurrentLocale())
  }, [])

  const setLanguage = async (langCode: string) => {
    const success = await setLocale(langCode)
    if (success) {
      setCurrentLanguage(langCode)
    } else {
      console.warn(`Language code ${langCode} is not supported.`)
    }
  }

  const t = (key: string, options?: Record<string, any>) => i18n.t(key, options)

  return (
    <I18nContext.Provider
      value={{ t, currentLanguage, setLanguage, availableLanguages }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
