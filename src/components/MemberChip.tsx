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
  /**
   * A short qualifier that belongs to the name rather than under it — "client", "retired", the kind of
   * thing that answers *what is this*.
   *
   * ⚠️ **Beside the name, not beneath it, and that is the whole difference from `subtitle`.** A chip
   * with two lines is twice as tall, which is fine in a list and wrong inside a one-line control: it
   * stretches the row it sits in over its neighbours. A qualifier is a few characters — it fits.
   */
  note?: string | null
  className?: string
}

/** Avatar + name (+ optional note or subtitle) — the one way a person is rendered across Tessera's screens. */
export function MemberChip({ member, subtitle, note, className }: MemberChipProperties) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <MemberAvatar member={member} className="size-7 shrink-0" />
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-medium">{memberName(member)}</span>
          {note && <span className="shrink-0 text-xs text-muted-foreground">{note}</span>}
        </div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  )
}
