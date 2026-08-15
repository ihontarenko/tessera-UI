import { MemberAvatar } from "@/components/MemberAvatar"
import { memberName } from "@/lib/memberDisplay"
import { cn } from "@/lib/helpers"
import type { MemberAvatarView } from "@/api/members"

interface MemberChipProperties {
  member?: {
    displayName?: string | null
    email?: string | null
    avatar?: MemberAvatarView | null
  } | null
  subtitle?: string | null
  className?: string
}

/** Avatar + name (+ optional subtitle) — the one way a person is rendered across Tessera's screens. */
export function MemberChip({ member, subtitle, className }: MemberChipProperties) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <MemberAvatar member={member} className="size-7 shrink-0" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{memberName(member)}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  )
}
