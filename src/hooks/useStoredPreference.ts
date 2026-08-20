import { useState } from "react"

/**
 * A piece of interface state that survives a reload — a view mode, a panel's width, a sort order.
 *
 * ⚠️ **`localStorage`, not the URL.** A folder is worth putting in a URL because it is what somebody
 * sends to somebody else; how *they* like their files drawn is not, and a link that carried it would
 * impose the sender's taste on the receiver.
 *
 * ⚠️ **A bad stored value falls back rather than throwing.** Storage is shared with every other version
 * of this application anybody has ever loaded in this browser, so a key can hold whatever an older build
 * wrote — and a `JSON.parse` on it during render takes the screen down.
 */
export function useStoredPreference<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return (window.localStorage.getItem(key) as T | null) ?? fallback
    } catch {
      // Private browsing modes refuse storage outright. A preference is not worth a broken screen.
      return fallback
    }
  })

  function remember(next: T) {
    setValue(next)

    try {
      window.localStorage.setItem(key, next)
    } catch {
      // Nothing to do and nothing to say: the choice still applies for this session.
    }
  }

  return [value, remember] as const
}
