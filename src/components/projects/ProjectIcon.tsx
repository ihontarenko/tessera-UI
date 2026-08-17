import { FolderKanban } from "lucide-react"
import { cn } from "@/lib/helpers"

/**
 * A project's face: its emoji, or the shared folder glyph where it has none (TSSR-7).
 *
 * One component rather than the same ternary in the switcher, the projects table and the page header —
 * the fallback is the part worth having in one place, because "no icon" is the ordinary state and a
 * screen that forgot the fallback renders a hole rather than an obvious bug.
 *
 * ⚠️ The emoji is `aria-hidden` and the glyph carries no label either. Both sit beside the project's
 * name every time they are used, and a screen reader announcing "rocket, Tessera" reads the decoration
 * as information.
 */
export function ProjectIcon({
  icon,
  className,
  size = "default",
}: {
  icon: string | null
  className?: string
  size?: "sm" | "default" | "lg"
}) {
  const emojiSize = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm"
  const glyphSize = size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : "size-4"

  if (icon) {
    return (
      <span aria-hidden className={cn("leading-none", emojiSize, className)}>
        {icon}
      </span>
    )
  }

  return <FolderKanban aria-hidden className={cn("shrink-0", glyphSize, className)} />
}
