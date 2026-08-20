import { LogOut } from "lucide-react"
import { useAuth } from "react-oidc-context"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"

// Lives in the sidebar footer, matching Innoventa's own user-menu-holds-sign-out placement — desktop
// has no persistent app-level header bar to put it in (see ApplicationLayout).
export function SignOutButton() {
  const auth = useAuth()
  const { t } = useLanguage()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => void auth.signoutRedirect()} tooltip={t("common.signOut", "Sign out")}>
          <LogOut className="size-4" />
          <span>{t("common.signOut", "Sign out")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
