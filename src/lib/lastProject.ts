/**
 * ⚠️ **The name says `Id` and the value is a reference**, and the string is deliberately not corrected.
 * Renaming it would discard what every existing browser has remembered, to fix a word nobody reads —
 * and an identifier already stored under it still resolves, because the project page accepts both
 * forms. New writes carry a key.
 */
const STORAGE_KEY = "tessera.lastProjectId"

/**
 * The project this browser was last working in (ticket 09), as the URL named it — a key, or an
 * identifier written before keys were used.
 *
 * Local to the browser rather than stored on the member, because it is a convenience about this device
 * and not a fact about the person — a phone and a desktop being in different projects is right, not a
 * conflict to reconcile. Every read is defensive: private-mode browsers can refuse `localStorage`
 * outright, and a switcher must never be the reason the shell fails to render.
 */
export function readLastProjectReference(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeLastProjectReference(reference: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, reference)
  } catch {
    // Nothing to do and nothing worth saying: the switcher works, it just will not remember.
  }
}
