import { Outlet } from "react-router-dom"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@jmouse/ui"
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
      {/* ⚠️ **The frame is the window, and the scrollbar is inside it.** Without `h-svh` the inset only
          has a *minimum* height, so a tall page grows the document and every screen that wants to fill
          the frame — a board, a file tree, a filter rail — silently scrolls the whole application
          instead of its own panes, taking the sidebar and the page header off the top with it. Innoventa
          and Kiwi have had this; Tessera was the one still without it. */}
      <SidebarInset className="h-svh overflow-hidden">
        <div className="flex h-10 shrink-0 items-center border-b px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
        </div>
        {/* ⚠️ `min-h-0` is load-bearing. A flex child's default `min-height: auto` refuses to shrink
            below its content, so a long list makes THIS box grow past the viewport — and then the window
            scrolls as well as the panel inside it, which is the two scrollbars down the right-hand side.
            ⚠️ And `overflow-x-hidden`, because a screen with a rail cancels this box's padding with
            `-mx-4`: that leaves it 1rem wider than this content box on each side by design, and `auto`
            on both axes would read those 2rem as something to scroll. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
