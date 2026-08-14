const STORAGE_KEY = "tessera.lastProjectId"

/**
 * The project this browser was last working in (ticket 09).
 *
 * Local to the browser rather than stored on the member, because it is a convenience about this device
 * and not a fact about the person — a phone and a desktop being in different projects is right, not a
 * conflict to reconcile. Every read is defensive: private-mode browsers can refuse `localStorage`
 * outright, and a switcher must never be the reason the shell fails to render.
 */
export function readLastProjectId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeLastProjectId(projectId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, projectId)
  } catch {
    // Nothing to do and nothing worth saying: the switcher works, it just will not remember.
  }
}
