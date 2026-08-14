import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/helpers"

interface SidebarPopoverProperties {
  trigger: (properties: { onClick: () => void; open: boolean }) => ReactNode
  children: ReactNode
  panelClassName?: string
}

/**
 * A dropdown panel anchored by ordinary CSS layout, with no positioning arithmetic anywhere.
 *
 * ⚠️ **This exists because floating-ui cannot be trusted under this application's font scale, and that
 * is measured rather than assumed.** Text size is `zoom` (see `ThemeContext`), and floating-ui divides
 * a trigger's `getBoundingClientRect()` by the scale it detects on it — which for a zoomed element is
 * the zoom — then writes the result as a transform. With a trigger inside the `position: fixed`
 * sidebar at 1.5×, a control sitting at y=18 opened its panel at y=654. Moving the zoom onto the
 * application root instead was tried: the same case then landed at y=436. Wrong either way, so there
 * is no zoom host that fixes it and the answer is not to do the arithmetic at all.
 *
 * Innoventa's own switcher works exactly this way — `position: relative` wrapper, `position: absolute`
 * panel pinned to its edge — and is immune for the same reason: the browser resolves the anchoring
 * during normal layout, inside the zoomed subtree, where every length already agrees.
 *
 * ⚠️ **It flips up when there is no room below**, which is the one thing normal layout will not do for
 * you. The measurement is a comparison of two viewport-space numbers — both from
 * `getBoundingClientRect()`/`innerHeight`, both in visual pixels — so it needs no knowledge of the
 * zoom either. Without it the account menu at the bottom of the sidebar opened straight off the
 * bottom of the screen.
 */
export function SidebarPopover({ trigger, children, panelClassName }: SidebarPopoverProperties) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<"bottom" | "top">("bottom")
  const containerReference = useRef<HTMLDivElement>(null)
  const panelReference = useRef<HTMLDivElement>(null)

  // Before paint, so the panel never renders in the wrong place for a frame and then jumps.
  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const container = containerReference.current
    const panel = panelReference.current

    if (container === null || panel === null) {
      return
    }

    const anchor = container.getBoundingClientRect()
    const panelHeight = panel.getBoundingClientRect().height
    const roomBelow = window.innerHeight - anchor.bottom
    const roomAbove = anchor.top

    // Only flip when below genuinely will not do AND above is the better of the two — a panel taller
    // than both gaps should stay where it was asked to go and scroll, rather than moving for nothing.
    setSide(panelHeight > roomBelow && roomAbove > roomBelow ? "top" : "bottom")
  }, [open])

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
          ref={panelReference}
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            // max-height counter-scaled against --body-zoom (ThemeContext) for the same reason as
            // components/ui/dropdown-menu.tsx — a length specified here still gets zoom-multiplied
            // at paint time even though this panel isn't Popper-positioned.
            "absolute inset-x-0 z-20 max-h-[calc(70vh/var(--body-zoom,1))] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            side === "bottom" ? "top-[calc(100%+4px)]" : "bottom-[calc(100%+4px)]",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
