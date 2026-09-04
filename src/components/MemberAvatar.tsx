import type { ComponentProps } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@jmouse/ui"
import { Avatar as GeneratedAvatar } from "@jmouse/avatars/picker"
import { memberInitials, memberName } from "@/lib/memberDisplay"
import type { MemberAvatarView } from "@/api/members"

interface MemberAvatarProperties extends ComponentProps<typeof Avatar> {
  member?: {
    displayName?: string | null
    email?: string | null
    avatar?: MemberAvatarView | null
  } | null
}

/**
 * A person's face — whichever of the three kinds they wear.
 *
 * ⚠️ **The one place that knows an avatar has kinds.** Everything else renders a person by rendering a
 * `MemberChip`, and the chip renders this; adding a fourth kind is a case added here and nothing else
 * touched. It is deliberately shaped like `Avatar` itself (same props, same sizes) so a screen wanting
 * a bare face without a name still gets the ring, the group offsets and the sizing behaviour.
 *
 * `avatar` is optional rather than required because a payload written before this existed — or a
 * partial member assembled locally — should render initials rather than crash. Initials are also what
 * an upload falls back to while its image is still in flight, which Radix handles: `AvatarImage` yields
 * to the fallback until the bytes decode.
 */
export function MemberAvatar({ member, ...properties }: MemberAvatarProperties) {
  const avatar = member?.avatar

  return (
    <Avatar {...properties}>
      {avatar?.kind === "UPLOAD" && avatar.url && (
        <AvatarImage src={avatar.url} alt={memberName(member)} />
      )}

      {/* ⚠️ **The `!` is load-bearing, and it is defending against a rule meant for icons.** A generated
          avatar is a bare `<svg>` with no class of its own, and controls that expect icons inside them —
          the select trigger, a select row, a button — carry `[&_svg:not([class*='size-'])]:size-4`. That
          matches a face as readily as a chevron, and a portrait squashed to 16px in the corner of its own
          28px box is what a chip looked like inside a picker. A portrait is content, not an affordance. */}
      {avatar?.kind === "PRESET" && avatar.preset ? (
        <GeneratedAvatar source={avatar.preset} size={null} className="block size-full [&>svg]:size-full!" />
      ) : (
        <AvatarFallback className="text-[11px]">{memberInitials(member)}</AvatarFallback>
      )}
    </Avatar>
  )
}
