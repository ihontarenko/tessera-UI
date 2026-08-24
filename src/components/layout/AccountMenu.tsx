import { NavLink } from "react-router-dom"
import { ChevronsUpDown, LogOut, Palette, UserRound } from "lucide-react"
import { useAuth } from "react-oidc-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Skeleton,
} from "@jmouse/ui"
import { MemberChip } from "@/components/MemberChip"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { useLanguage } from "@/context/LanguageContext"

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
 * ⚠️ **Access is not here any more, and its absence is the point.** It was offered from this menu —
 * first to everybody and then only to holders of `access:administer` — which filed the installation's
 * authorization under "about you". It is a section of Administration now, beside Members and the
 * catalogs, and `/settings/access` redirects there.
 */
export function AccountMenu() {
  const auth = useAuth()
  const { t } = useLanguage()
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
                  unbadged. What is actually true installation-wide is `globalPermissions`, which the
                  account page shows in full. */}
              <MemberChip member={member} subtitle={member.displayName ? member.email : null} />
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-(--sidebar-width) max-w-[16rem]">
            {/* ⚠️ The language switcher is HIDDEN, not removed, and it is meant to come back. It offered
                English and Ukrainian while the Ukrainian side of the catalog is a fraction of the keys,
                so choosing it produced a half-translated interface — worse than the untranslated one,
                because the gaps look like faults. `LanguageProvider` and every `t(key, fallback)` call
                are untouched and still resolve; only the control is gone. Bringing it back is a labelled
                group of `DropdownMenuItem`s here, one per language, ticking the current one. */}

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
