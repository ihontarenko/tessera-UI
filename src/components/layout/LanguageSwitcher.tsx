import { Check, Languages } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@jmouse/ui"
import { useLanguage, type Language } from "@/context/LanguageContext"

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  uk: "Українська",
}

/**
 * The language, as a sidebar row of its own.
 *
 * ⚠️ **Nothing renders this today** — the shell's language choice moved into `AccountMenu`, with the
 * rest of the settings that are about the person rather than the work. It is kept because a sidebar
 * that wants the choice back as its own row should find it here rather than rebuild it, and it was
 * moved onto the ordinary `DropdownMenu` with everything else so that it cannot rot into the one
 * component still using a mechanism this application has retired.
 */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={t("common.language", "Language")}>
              <Languages className="size-4" />
              <span>{LANGUAGE_LABELS[language]}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--sidebar-width) max-w-[16rem]">
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((option) => (
              <DropdownMenuItem key={option} onClick={() => setLanguage(option)}>
                {LANGUAGE_LABELS[option]}
                {language === option && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
