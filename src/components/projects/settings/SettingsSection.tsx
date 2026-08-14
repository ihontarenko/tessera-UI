import type { ReactNode } from "react"

/**
 * The frame every Settings section shares: a title, one line saying what the section decides, and the
 * controls. Written once so the five sections read as one screen rather than five screens that happen
 * to sit behind the same tab (ticket 06).
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-display text-base font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  )
}

/** A read-only fact: label on the left, value on the right, one per line. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}

/** Shown in place of a section's controls when the member may look but not change anything. */
export function ReadOnlyNotice({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>
}
