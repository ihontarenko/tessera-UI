import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/helpers"

interface SidebarPopoverProperties {
  trigger: (properties: { onClick: () => void; open: boolean }) => ReactNode
  children: ReactNode
  panelClassName?: string
}

// Innoventa's own space switcher (.switcherWrap/.switcherDropdown, AppLayout.module.css) isn't a
// Radix Popper component at all — it's a plain position:relative wrapper with a position:absolute
// panel pinned to its own bottom edge, positioned entirely by the browser's normal CSS layout, not
// JS-computed floating-ui math. That's why it's immune to the bug Radix DropdownMenu hits here:
// under fontScale's body.style.zoom, floating-ui's getBoundingClientRect()-based trigger-position
// calculation returns coordinates that don't correspond to the trigger's real on-screen position
// inside this zoomed, position:fixed sidebar, so the menu opens anchored to the wrong point
// entirely (see task #82). A plain CSS-anchored panel has no such calculation to get wrong.
export function SidebarPopover({ trigger, children, panelClassName }: SidebarPopoverProperties) {
  const [open, setOpen] = useState(false)
  const containerReference = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerReference.current && !containerReference.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerReference} className="relative">
      {trigger({ onClick: () => setOpen((current) => !current), open })}
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            // max-height counter-scaled against --body-zoom (ThemeContext) for the same reason as
            // components/ui/dropdown-menu.tsx — a length specified here still gets zoom-multiplied
            // at paint time even though this panel isn't Popper-positioned.
            "absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-[calc(70vh/var(--body-zoom,1))] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
