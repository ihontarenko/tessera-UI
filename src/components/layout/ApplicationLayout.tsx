import { Outlet } from "react-router-dom"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { ApplicationSidebar } from "@/components/layout/ApplicationSidebar"
import { SeasonalEffect } from "@/components/layout/SeasonalEffect"

// No persistent desktop header — Innoventa's own AppLayout has none either; sign-out and the page
// title live in the sidebar footer and each page's own PageHeader respectively (see
// ApplicationSidebar/PageHeader), so a page's content starts flush at the top like Innoventa's does.
// The trigger below is mobile-only (md:hidden), mirroring Innoventa's .mobileTopbar, which is the
// only place a header bar exists in its layout at all.
export function ApplicationLayout() {
  return (
    <SidebarProvider>
      <SeasonalEffect />
      <ApplicationSidebar />
      <SidebarInset>
        <div className="flex h-10 shrink-0 items-center border-b px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
