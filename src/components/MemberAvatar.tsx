import type { ComponentProps } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PixelFace } from "@/components/PixelFace"
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

      {avatar?.kind === "PRESET" && avatar.preset ? (
        <PixelFace seed={avatar.preset} />
      ) : (
        <AvatarFallback className="text-[11px]">{memberInitials(member)}</AvatarFallback>
      )}
    </Avatar>
  )
}
