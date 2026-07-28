interface DisplayableMember {
  displayName?: string | null
  email?: string | null
}

/** The best human-facing label a member offers: display name, else email, else a fallback. */
export function memberName(member?: DisplayableMember | null, fallback = "Unknown member"): string {
  if (!member) {
    return fallback
  }

  return member.displayName || member.email || fallback
}

/** Up to two initials for an avatar fallback, from the display name (or email local part). */
export function memberInitials(member?: DisplayableMember | null): string {
  const source = member?.displayName || member?.email || "?"
  const parts = source.trim().split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}
