import { NavLink, useLocation } from "react-router-dom"
import { Palette } from "lucide-react"
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
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ProjectSwitcher } from "@/components/layout/ProjectSwitcher"
import { SignOutButton } from "@/components/layout/SignOutButton"
import { CurrentMemberCard } from "@/components/layout/CurrentMemberCard"
import { useLanguage } from "@/context/LanguageContext"

function isNavigationItemActive(pathname: string, itemPath: string) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}

export function ApplicationSidebar() {
  const { pathname } = useLocation()
  const { t } = useLanguage()

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
            (ticket 09) takes the slot Innoventa's space switcher occupies, and LanguageSwitcher moved
            up from the footer for the same fontScale-zoom / Radix-positioning reason it was moved in
            Moneta — see the SidebarPopover comment. */}
        <ProjectSwitcher />
        <LanguageSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {navigationGroups.map((group) => (
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
      <SidebarFooter>
        {/* A page (AppearanceSettingsPage), not a dropdown — see the LanguageSwitcher comment above
            for why a popover this size doesn't survive fontScale zoom in this footer position. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t("common.appearance", "Appearance")}
              isActive={isNavigationItemActive(pathname, "/settings/appearance")}
            >
              <NavLink to="/settings/appearance">
                <Palette className="size-4" />
                <span>{t("common.appearance", "Appearance")}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <CurrentMemberCard />
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  )
}
