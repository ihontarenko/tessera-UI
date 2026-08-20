import { Badge, Skeleton } from "@jmouse/ui"
import { MemberChip } from "@/components/MemberChip"
import { useCurrentMember } from "@/hooks/useCurrentMember"

/**
 * The signed-in member as Tessera knows them (name/email/avatar), sourced from
 * {@code GET /api/members/me} — not the raw token — so the shell shows the local record. An
 * instance {@code ADMIN} is badged.
 */
export function CurrentMemberCard() {
  const { data: member, isLoading } = useCurrentMember()

  if (isLoading) {
    return (
      <div className="px-2 py-1.5">
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  if (!member) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <MemberChip member={member} subtitle={member.displayName ? member.email : null} />
      {member.systemRole === "ADMIN" && (
        <Badge variant="secondary" className="shrink-0">
          Admin
        </Badge>
      )}
    </div>
  )
}
