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
import { navigationGroups } from "@/navigation"
import { AccountMenu } from "@/components/layout/AccountMenu"
import { ProjectSwitcher } from "@/components/layout/ProjectSwitcher"
import { useLanguage } from "@/context/LanguageContext"
import { useCurrentMember } from "@/hooks/useCurrentMember"

function isNavigationItemActive(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

export function ApplicationSidebar() {
  const { pathname } = useLocation()
  const { t } = useLanguage()
  const { data: currentMember } = useCurrentMember()

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

  return (
    // No collapsible="icon" mode — Innoventa's own sidebar is always fully expanded on desktop and
    // only becomes an off-canvas drawer on mobile (the default here), never an icon-only rail.
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Ports Innoventa's BrandMark(size=36)/.brand/.brandName/.brandTag exactly
                (AppLayout.tsx/.module.css): 36px mark with a 24px (36*0.67) icon, 22px name at
                -0.02em tracking, and the second brandTag line shadcn's default lacks entirely. */}
            <SidebarMenuButton size="lg" className="h-auto gap-2.5 px-1.5 py-1" asChild>
              <NavLink to="/">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                  <TesseraMark className="size-6" />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="font-display text-[22px] leading-none tracking-[-0.02em]">
                    Tessera
                  </span>
                  <span className="mt-[3px] text-[10px] tracking-[0.07em] text-muted-foreground uppercase">
                    issue tracker
                  </span>
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
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      tooltip={t(item.translationKey, item.title)}
                      isActive={isNavigationItemActive(pathname, item.path)}
                    >
                      <NavLink to={item.path}>
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
