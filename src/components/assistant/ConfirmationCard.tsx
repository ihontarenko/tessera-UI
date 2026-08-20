import { useEffect, useState } from "react"
import { Button } from "@jmouse/ui"
import { confirmationInstruction } from "@/lib/assistantTranscript"
import type { ConfirmationPreview } from "@/lib/assistantTranscript"
import { cn } from "@/lib/helpers"

interface ConfirmationCardProperties {
  preview: ConfirmationPreview
  /** Which action was previewed — named on the card, because the token authorises only that one. */
  action: string
  /** Whether this is the pending decision, or the record of one already taken. */
  live: boolean
  busy: boolean
  onConfirm: (instruction: string) => void
}

/**
 * What would happen, before it happens — and the button that agrees to it.
 *
 * The list is the protection and the button is only the ceremony. The guard froze a specific set of
 * issues and issued a token authorising those and nothing else, so the card shows all of them rather
 * than a count: "12 issues" is a number somebody nods at, and twelve keys is a list somebody reads.
 * Anything added since the preview is not affected, which the card says out loud because that is the
 * one thing about a frozen set that surprises people.
 *
 * ⚠️ Confirming sends a message, in words, that the person can read afterwards. It is not a side
 * channel: the instruction appears in the transcript exactly as it was sent, naming the action, the
 * count and the token. A conversation where a button inserts something invisible is one where nobody
 * can later say what was agreed to.
 */
export function ConfirmationCard({ preview, action, live, busy, onConfirm }: ConfirmationCardProperties) {
  const secondsLeft = useSecondsLeft(preview.expiresInSeconds, live && !preview.redeemed)
  const expired = secondsLeft === 0
  const decided = preview.redeemed || !live

  return (
    <section
      className={cn(
        "rounded-lg border border-l-[3px] p-3.5",
        decided
          ? "border-border border-l-muted-foreground bg-muted"
          : "border-destructive/35 border-l-destructive bg-destructive/5",
      )}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "text-[11px] font-bold tracking-wide uppercase",
            decided ? "text-muted-foreground" : "text-destructive-ink",
          )}
        >
          Confirmation needed
        </span>
        <code className="rounded bg-foreground/5 px-1.5 py-px font-mono text-xs text-secondary-foreground">
          {action}
        </code>
        <span className="ml-auto text-xs font-semibold text-secondary-foreground">
          {preview.count} {preview.count === 1 ? "record" : "records"}
        </span>
      </header>

      {preview.reason && (
        <p className="mb-2.5 text-[13px] leading-relaxed text-secondary-foreground">{preview.reason}</p>
      )}

      {preview.records.length > 0 && (
        <ul className="mb-2 max-h-64 overflow-y-auto rounded-md border bg-card">
          {preview.records.map((record) => (
            <li key={record.id} className="flex items-center gap-2 border-b px-2.5 py-1.5 text-[13px] last:border-b-0">
              <span className="truncate">{record.label}</span>
              {record.kind && (
                <span className="shrink-0 rounded border px-1.5 text-[11px] text-muted-foreground">{record.kind}</span>
              )}
              <code className="ml-auto shrink-0 font-mono text-[11px] text-ink-4">{record.id}</code>
            </li>
          ))}
        </ul>
      )}

      {preview.records.length < preview.count && (
        <p className="mb-2 text-xs text-muted-foreground">
          Showing {preview.records.length} of {preview.count} — the rest are affected too.
        </p>
      )}

      <footer className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
        {decided && (
          <span>{preview.redeemed ? "Confirmed and carried out." : "Superseded by a later preview."}</span>
        )}

        {!decided && expired && (
          <span>This preview has expired. Ask again to see a fresh list — it may have changed.</span>
        )}

        {!decided && !expired && (
          <>
            <span>
              Only these are affected — anything added since is not. Expires in {secondsLeft}s.
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              disabled={busy}
              onClick={() => onConfirm(confirmationInstruction(preview, action))}
            >
              {busy ? "Confirming…" : "Confirm"}
            </Button>
          </>
        )}
      </footer>
    </section>
  )
}

/**
 * How long this token has left, counted from the moment the card appeared.
 *
 * Mount time stands in for issue time — the card is drawn as soon as the answer carrying it arrives,
 * and the transcript keys each preview by its own call so nothing remounts it afterwards. It ticks so
 * the card cannot go on offering a button for a token the server would refuse; the refusal itself is
 * perfectly clear, but it costs a round trip to learn something the screen already knew.
 */
function useSecondsLeft(lifetime: number, ticking: boolean): number {
  const [expiresAt] = useState(() => Date.now() + lifetime * 1000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!ticking) {
      return
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(timer)
  }, [ticking])

  return Math.max(0, Math.round((expiresAt - now) / 1000))
}
