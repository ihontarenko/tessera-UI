import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { memberInitials, memberName } from "@/lib/memberDisplay"
import { cn } from "@/lib/helpers"

interface MemberChipProperties {
  member?: { displayName?: string | null; email?: string | null } | null
  subtitle?: string | null
  className?: string
}

/** Avatar + name (+ optional subtitle) — the one way a person is rendered across Tessera's screens. */
export function MemberChip({ member, subtitle, className }: MemberChipProperties) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[11px]">{memberInitials(member)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{memberName(member)}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  )
}
