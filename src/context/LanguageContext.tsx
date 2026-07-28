import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { useTranslations } from "@/api/translations"

export type Language = "en" | "uk"

const LANGUAGE_STORAGE_KEY = "tessera.language"

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, fallback: string) => string
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

interface LanguageProviderProperties {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProperties) {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null) ?? "en",
  )
  // "tessera" is this app's key in Central's shared translations table. Coverage is partial by
  // design (like Moneta) — every `t(key, fallback)` returns its English fallback until a row exists,
  // so the UI is fully usable in English before any translation is authored.
  const { data: translations, isLoading } = useTranslations("tessera", language)

  const setLanguage = (nextLanguage: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    setLanguageState(nextLanguage)
  }

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string, fallback: string) => translations?.[key] ?? fallback,
      isLoading,
    }),
    [language, translations, isLoading],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }

  return context
}
