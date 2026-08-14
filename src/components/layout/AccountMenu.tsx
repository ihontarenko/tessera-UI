import { NavLink } from "react-router-dom"
import { Check, ChevronsUpDown, LogOut, Palette, ShieldCheck, UserRound } from "lucide-react"
import { useAuth } from "react-oidc-context"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MemberChip } from "@/components/MemberChip"
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
 * It replaced five permanent rows — a language switcher parked up in the header, a member card, an
 * Appearance link, an Access link and a Sign out button. None of them is something anybody clicks
 * during a working day, and five rows for that is a footer competing with the navigation above it.
 *
 * ⚠️ **An ordinary `DropdownMenu`.** It briefly used a hand-rolled panel, because the positioning
 * library could not survive the font-scale zoom and opened menus off the bottom of the screen. Overlays
 * are anchored by the browser now (`components/ui/anchored.tsx`), so there is one dropdown mechanism in
 * this application and this is it — including the flip that keeps a footer menu on screen.
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="h-auto py-1.5" tooltip={t("common.account", "Account")}>
              {/* ⚠️ No "Admin" badge, and the absence is deliberate. It read
                  `systemRole === "ADMIN"` — a role check, in a product whose whole authorization model
                  is that a role is an editable bundle and never a thing to branch on. It was wrong
                  twice over: `systemRole` gates nothing on the server, so the badge described a field
                  that decides nothing; and a role above ADMIN would leave the most powerful person
                  unbadged. What is actually true installation-wide is `globalPermissions` — which this
                  menu already uses to decide whether to offer Access, and which the account page
                  shows in full. */}
              <MemberChip member={member} subtitle={member.displayName ? member.email : null} />
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-(--sidebar-width) max-w-[16rem]">
            <DropdownMenuLabel className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">
              {t("common.language", "Language")}
            </DropdownMenuLabel>
            {(Object.keys(LANGUAGE_LABELS) as Language[]).map((option) => (
              <DropdownMenuItem key={option} onClick={() => setLanguage(option)}>
                {LANGUAGE_LABELS[option]}
                {language === option && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Who you are here, what you hold installation-wide, and how to point a Model Context
                Protocol client at this installation. Open to everybody: the only thing on it to copy
                is a URL, and the client authenticates as whoever is reading the page. */}
            <DropdownMenuItem asChild>
              <NavLink to="/settings/account">
                <UserRound className="size-4" />
                {t("common.account", "Account")}
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <NavLink to="/settings/appearance">
                <Palette className="size-4" />
                {t("common.appearance", "Appearance")}
              </NavLink>
            </DropdownMenuItem>
            {administersAccess && (
              <DropdownMenuItem asChild>
                <NavLink to="/settings/access">
                  <ShieldCheck className="size-4" />
                  {t("common.access", "Access")}
                </NavLink>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => void auth.signoutRedirect()}>
              <LogOut className="size-4" />
              {t("common.signOut", "Sign out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
