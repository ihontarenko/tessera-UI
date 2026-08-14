import { NavLink } from "react-router-dom"
import { Check, ChevronsUpDown, LogOut, Palette, ShieldCheck } from "lucide-react"
import { useAuth } from "react-oidc-context"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { MemberChip } from "@/components/MemberChip"
import { SidebarPopover } from "@/components/layout/SidebarPopover"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { useLanguage, type Language } from "@/context/LanguageContext"
import { ADMINISTER_ACCESS } from "@/api/permissions"

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  uk: "Українська",
}

/**
 * The one thing in the sidebar's footer: who you are, and everything that is about you rather than
 * about the work.
 *
 * It replaced four separate rows — a language switcher parked up in the header, a member card, an
 * Appearance link, an Access link and a Sign out button. None of them is something anybody clicks
 * during a working day, and five permanent rows for that is a footer competing with the navigation
 * above it. One row, opened when wanted.
 *
 * ⚠️ **`SidebarPopover`, never a Radix menu, and the reason is `body.style.zoom`.** Font scale is
 * implemented as a zoom on `<body>`, and floating-ui positions a Popper from
 * `getBoundingClientRect()` — inside this zoomed, `position: fixed` sidebar those coordinates do not
 * correspond to where the trigger actually is, so the panel opens anchored somewhere else entirely.
 * A CSS-anchored panel has no such calculation to get wrong. Nothing here nests a second panel for
 * the same reason: the language rows sit in this one.
 *
 * ⚠️ **Access is rendered only for holders**, from the caller's installation-wide permissions. It used
 * to be shown to everybody and refused by the server, because the shell had no way to ask — it has one
 * now, so a link nobody without the permission can use is no longer offered.
 */
export function AccountMenu() {
  const auth = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const { data: member, isLoading } = useCurrentMember()

  if (isLoading) {
    return (
      <div className="px-2 py-1.5">
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (!member) {
    return null
  }

  const administersAccess = member.globalPermissions.includes(ADMINISTER_ACCESS)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarPopover
          trigger={({ onClick, open }) => (
            <SidebarMenuButton
              size="lg"
              onClick={onClick}
              isActive={open}
              className="h-auto py-1.5"
              tooltip={t("common.account", "Account")}
            >
              <MemberChip member={member} subtitle={member.displayName ? member.email : null} />
              {member.systemRole === "ADMIN" && (
                <Badge variant="secondary" className="shrink-0">
                  Admin
                </Badge>
              )}
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            </SidebarMenuButton>
          )}
        >
          <MenuSection label={t("common.language", "Language")} />
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((option) => (
            <button key={option} type="button" onClick={() => setLanguage(option)} className={ROW}>
              {LANGUAGE_LABELS[option]}
              {language === option && <Check className="ml-auto size-4" />}
            </button>
          ))}

          <MenuSection label={t("common.settings", "Settings")} />
          <NavLink to="/settings/appearance" className={ROW}>
            <Palette className="size-4" />
            {t("common.appearance", "Appearance")}
          </NavLink>
          {administersAccess && (
            <NavLink to="/settings/access" className={ROW}>
              <ShieldCheck className="size-4" />
              {t("common.access", "Access")}
            </NavLink>
          )}

          <div className="my-1 border-t" />
          <button type="button" onClick={() => void auth.signoutRedirect()} className={ROW}>
            <LogOut className="size-4" />
            {t("common.signOut", "Sign out")}
          </button>
        </SidebarPopover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/** One row of the panel, whether it navigates or acts — they read the same, so they look the same. */
const ROW =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"

function MenuSection({ label }: { label: string }) {
  return (
    <div className="px-2 pt-1.5 pb-0.5 text-[10px] tracking-[0.07em] text-muted-foreground uppercase">
      {label}
    </div>
  )
}
