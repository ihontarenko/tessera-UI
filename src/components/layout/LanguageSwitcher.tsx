import { Check, Languages } from "lucide-react"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { SidebarPopover } from "@/components/layout/SidebarPopover"
import { useLanguage, type Language } from "@/context/LanguageContext"

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  uk: "Українська",
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarPopover
          trigger={({ onClick, open }) => (
            <SidebarMenuButton onClick={onClick} isActive={open} tooltip={t("common.language", "Language")}>
              <Languages className="size-4" />
              <span>{LANGUAGE_LABELS[language]}</span>
            </SidebarMenuButton>
          )}
        >
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((languageOption) => (
            <button
              key={languageOption}
              type="button"
              onClick={() => setLanguage(languageOption)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {LANGUAGE_LABELS[languageOption]}
              {language === languageOption && <Check className="ml-auto size-4" />}
            </button>
          ))}
        </SidebarPopover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
