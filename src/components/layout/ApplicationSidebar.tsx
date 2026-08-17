import { NavLink, useLocation } from "react-router-dom"
import { TesseraMark } from "@/components/icons/TesseraMark"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { navigationGroups, type NavigationGroup, type NavigationLocation } from "@/navigation"
import { AccountMenu } from "@/components/layout/AccountMenu"
import { ProjectSwitcher } from "@/components/layout/ProjectSwitcher"
import { useLanguage } from "@/context/LanguageContext"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId"

function isNavigationItemActive(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

/**
 * The one entry the current location counts as being on — by translation key, which is unique and
 * stable where a path no longer is (TSSR-23).
 *
 * ⚠️ **One winner, not a predicate per row.** `/projects/x?tab=issues` is described by both **Projects**
 * and **Issues**, and two highlighted rows read as a broken menu rather than as a nested place. An
 * entry that says for itself when it is active wins outright; the rest fall back to the prefix match,
 * longest path first, so a future `/settings/access` could never be outranked by `/settings`.
 */
function activeNavigationKey(groups: NavigationGroup[], location: NavigationLocation): string | null {
  const items = groups.flatMap((group) => group.items)
  const declared = items.find((item) => item.matches?.(location))

  if (declared) {
    return declared.translationKey
  }

  return (
    items
      .filter((item) => !item.matches && isNavigationItemActive(location.pathname, item.path))
      .sort((first, second) => second.path.length - first.path.length)
      .at(0)?.translationKey ?? null
  )
}

export function ApplicationSidebar() {
  const location = useLocation()
  const { t } = useLanguage()
  const { data: currentMember } = useCurrentMember()
  const currentProjectId = useCurrentProjectId()

  // ⚠️ A courtesy, not the authorization — every route below is gated server-side and refuses on its
  // own. What it buys is that somebody who cannot edit the configuration is not offered a screen full
  // of controls that will all say no. A group whose every entry is hidden goes with them: an empty
  // heading reads as something broken rather than as something absent.
  const held = currentMember?.globalPermissions ?? []
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.requiredGlobalPermission || held.includes(item.requiredGlobalPermission),
      ),
    }))
    .filter((group) => group.items.length > 0)

  const activeKey = activeNavigationKey(visibleGroups, location)

  return (
    // No collapsible="icon" mode — Innoventa's own sidebar is always fully expanded on desktop and
    // only becomes an off-canvas drawer on mobile (the default here), never an icon-only rail.
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Ports Innoventa's BrandMark(size=36)/.brand/.brandName lockup exactly
                (AppLayout.tsx/.module.css): 36px mark with a 24px (36*0.67) icon, and the name in
                Onest at 24px/700/-0.02em — the same four values Innoventa's `--brand-*` tokens hold.

                ⚠️ The wordmark and nothing under it. There was a second line reading "issue tracker",
                and it was the letterhead answering a question nothing had asked: what this product is
                is said by the project switcher directly below and by every screen the menu opens. A
                logotype carries a name, not a description of itself — Innoventa removed its own second
                line for the same reason, and the column wrapper went with it because there is no
                longer anything to stack.

                ⚠️ font-bold is stated here rather than inherited: SidebarMenuButton carries
                font-medium, so the wordmark used to render at 500 and read visibly lighter than the
                same word does in Innoventa. A logotype is the one place two products cannot afford
                to look like two brands. */}
            <SidebarMenuButton size="lg" className="h-auto gap-2.5 px-1.5 py-1" asChild>
              <NavLink to="/">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                  <TesseraMark className="size-6" />
                </span>
                <span className="min-w-0 flex-1 font-brand text-[24px] leading-none font-bold tracking-[-0.02em]">
                  Tessera
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* No PersonaSwitcher here — there's no persona concept in this app. The project switcher
            (ticket 09) takes the slot Innoventa's space switcher occupies, and it is the only thing
            beside the brand: it is about the work, which is what the top of a sidebar is for.
            Language moved down into the account menu, where the rest of the personal settings are. */}
        <ProjectSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{t(group.translationKey, group.title)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.translationKey}>
                    <SidebarMenuButton
                      asChild
                      tooltip={t(item.translationKey, item.title)}
                      isActive={activeKey === item.translationKey}
                    >
                      <NavLink to={item.resolvePath?.({ currentProjectId }) ?? item.path}>
                        <item.icon />
                        <span>{t(item.translationKey, item.title)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {!item.isBuilt && <SidebarMenuBadge>{t("nav.soon", "soon")}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {/* One row, holding everything that is about the person rather than about the work — language,
          appearance, access, sign out. It used to be five permanent rows for things nobody clicks
          during a working day, which is a footer competing with the navigation above it. */}
      <SidebarFooter>
        <AccountMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
