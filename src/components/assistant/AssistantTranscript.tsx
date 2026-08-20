import { useMemo } from "react"
import { TesseraMarkdown } from "@/components/markdown/TesseraMarkdown"
import { ConfirmationCard } from "@/components/assistant/ConfirmationCard"
import type { AssistantAction, ConfirmationPreview, TranscriptEntry } from "@/lib/assistantTranscript"
import { cn } from "@/lib/helpers"

/** What one exchange cost, kept beside the answer it paid for rather than totalled out of sight. */
export interface TurnRecord {
  /** The message this turn ended on — how a cost finds the answer it belongs to. */
  lastMessageIndex: number
  toolCalls: number
  inputTokens: number
  outputTokens: number
  finished: boolean
}

interface AssistantTranscriptProperties {
  entries: TranscriptEntry[]
  turns: TurnRecord[]
  /** The one preview still awaiting a decision, if there is one. */
  pending: ConfirmationPreview | null
  busy: boolean
  onConfirm: (instruction: string) => void
}

/**
 * The conversation, drawn.
 *
 * Everything here is derived from the message array the server returned — see `buildTranscript`.
 * Nothing is remembered locally about what was said, so the transcript cannot come to disagree with
 * what the model actually saw.
 */
export function AssistantTranscript({ entries, turns, pending, busy, onConfirm }: AssistantTranscriptProperties) {
  const costs = useMemo(() => costsByPosition(entries, turns), [entries, turns])

  return (
    <div className="flex flex-col gap-3.5">
      {entries.map((entry, position) => (
        <div key={entry.key}>
          {renderEntry(entry, pending, busy, onConfirm)}
          {costs.has(position) && <TurnCost record={costs.get(position)!} />}
        </div>
      ))}
    </div>
  )
}

function renderEntry(
  entry: TranscriptEntry,
  pending: ConfirmationPreview | null,
  busy: boolean,
  onConfirm: (instruction: string) => void,
) {
  switch (entry.kind) {
    case "question":
      return <p className="border-l-[3px] border-primary pl-3 font-display text-[15px] leading-snug font-semibold whitespace-pre-wrap">{entry.text}</p>

    case "answer":
      return <TesseraMarkdown markdown={entry.text} className="text-sm" />

    case "actions":
      return (
        <ul className="flex flex-col gap-1.5">
          {entry.actions.map((action) => (
            <li key={action.toolUseId}>
              <ActionLine action={action} />
            </li>
          ))}
        </ul>
      )

    case "preview":
      return (
        <ConfirmationCard
          preview={entry.preview}
          action={entry.action}
          live={pending?.token === entry.preview.token}
          busy={busy}
          onConfirm={onConfirm}
        />
      )
  }
}

const OUTCOME_DOT: Record<AssistantAction["outcome"], string> = {
  succeeded: "bg-success",
  refused: "bg-destructive",
  previewed: "bg-warning",
  pending: "bg-muted-foreground",
}

/**
 * One action, on one line: what it did, where it did it, and — when it was refused — why, in the
 * sentence the model was given.
 *
 * ⚠️ Those refusals are the finding ticket 18 produced. A workflow's own refusal is written for a
 * person, and passing it through unchanged is what lets the reader see the same useful thing the
 * model saw — including when the useful thing is that the model could not act on it either.
 */
function ActionLine({ action }: { action: AssistantAction }) {
  return (
    <div className="rounded-md border bg-muted/40 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("size-[7px] shrink-0 rounded-full", OUTCOME_DOT[action.outcome])} aria-hidden="true" />
        <code className="font-mono text-xs text-secondary-foreground">{action.name}</code>
        {action.scope && (
          <span className="text-xs text-muted-foreground" title={`${action.scope.kind} scope`}>
            {action.scope.name}
            {action.scope.wasDefault && <span className="text-ink-4"> by default</span>}
          </span>
        )}
        {action.reason && (
          <span className="rounded bg-destructive/10 px-1.5 text-[11px] text-destructive-ink">
            {action.reason.toLowerCase().replace(/_/g, " ")}
          </span>
        )}
        {action.outcome === "pending" && (
          <span className="rounded bg-muted px-1.5 text-[11px] text-muted-foreground">never answered</span>
        )}
      </div>

      {action.refusal && <p className="mt-1.5 text-[13px] leading-relaxed text-secondary-foreground">{action.refusal}</p>}

      {action.payload && (
        <details className="mt-1.5 text-xs">
          <summary className="cursor-pointer text-muted-foreground select-none">What came back</summary>
          <pre className="mt-1.5 max-h-72 overflow-auto rounded-md border bg-background p-2.5 font-mono text-[11px] leading-relaxed text-secondary-foreground">
            {action.payload}
          </pre>
        </details>
      )}
    </div>
  )
}

/**
 * Cost, beside the answer rather than in a corner of the header. An assistant spends somebody's money
 * on their behalf, and showing what a turn cost where the turn is means it is read rather than
 * discovered — which is the whole reason the response carries it.
 */
function TurnCost({ record }: { record: TurnRecord }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-dashed pt-2 text-[11px] text-ink-4">
      {!record.finished && (
        <span className="text-warning">
          Stopped before finishing — the answer above is where it got to, not a result.
        </span>
      )}
      <span className="ml-auto" />
      {record.toolCalls > 0 && (
        <span>
          {record.toolCalls} {record.toolCalls === 1 ? "action" : "actions"}
        </span>
      )}
      <span>{record.inputTokens + record.outputTokens} tokens</span>
    </div>
  )
}

/**
 * Where each turn's cost line goes: after the last thing that turn produced. A turn ends on an
 * assistant message, which may have produced an answer, an action strip, or both — so the position is
 * found rather than assumed, and a turn whose final message drew nothing has no cost line rather than
 * an orphaned one.
 */
function costsByPosition(entries: TranscriptEntry[], turns: TurnRecord[]): Map<number, TurnRecord> {
  const positions = new Map<number, TurnRecord>()

  turns.forEach((record) => {
    for (let position = entries.length - 1; position >= 0; position -= 1) {
      if (entries[position].index === record.lastMessageIndex) {
        positions.set(position, record)
        return
      }
    }
  })

  return positions
}
