import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/EmptyState"
import { PageHeader } from "@/components/PageHeader"
import { AssistantTranscript } from "@/components/assistant/AssistantTranscript"
import type { TurnRecord } from "@/components/assistant/AssistantTranscript"
import { askAssistant, fetchAssistantAvailability } from "@/api/assistant"
import type { AssistantAnswer, AssistantAsk } from "@/api/assistant"
import { buildTranscript, pendingConfirmation } from "@/lib/assistantTranscript"
import type { AssistantMessage } from "@/lib/assistantTranscript"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Somebody asking Tessera about their own projects, in words.
 *
 * This screen holds a text box, a transcript and a Confirm button. Every tool, every project
 * permission, the workflow engine's own refusals, the guards and the call counters are behind
 * `POST /api/assistant/ask` and none of them are mentioned here — the assistant holds the same
 * dispatcher a connected Model Context Protocol client holds, in process, as the person asking.
 *
 * ⚠️ No permission gate, deliberately. Every action is already gated per project by Tessera's own
 * model, so a member who belongs to no project gets an assistant that can reach nothing. Innoventa
 * gates the conversation itself because a message costs an installation budget; when Tessera has a
 * bill to protect, the gate belongs on the controller first and here second.
 *
 * ⚠️ The conversation lives in this component and nowhere else. A reload starts a new one — a stored
 * conversation contains whatever the tools returned, which is somebody's issues copied into a second
 * place with a second lifetime, and writing it to local storage would answer that by accident.
 */
export function AssistantPage() {
  const { t } = useLanguage()

  const availability = useQuery({
    queryKey: ["assistant", "availability"],
    queryFn: fetchAssistantAvailability,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const ask = useMutation<AssistantAnswer, unknown, AssistantAsk>({ mutationFn: askAssistant })

  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [turns, setTurns] = useState<TurnRecord[]>([])
  const [draft, setDraft] = useState("")
  const [asked, setAsked] = useState<string | null>(null)

  const entries = useMemo(() => buildTranscript(messages), [messages])
  const pending = useMemo(() => pendingConfirmation(entries), [entries])
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [entries.length, asked])

  function send(question: string) {
    const trimmed = question.trim()

    if (trimmed.length === 0 || ask.isPending) {
      return
    }

    setAsked(trimmed)
    setDraft("")

    ask.mutate(
      { question: trimmed, messages },
      {
        onSuccess: (answer) => {
          setMessages(answer.messages)
          setTurns((existing) => [
            ...existing,
            {
              lastMessageIndex: answer.messages.length - 1,
              toolCalls: answer.toolCalls,
              inputTokens: answer.inputTokens,
              outputTokens: answer.outputTokens,
              finished: answer.finished,
            },
          ])
          setAsked(null)
        },
        // ⚠️ The conversation is left exactly as it was. A turn that never reached the model changed
        // nothing, and putting the question back in the box is what lets somebody send it again
        // rather than retype it.
        onError: () => {
          setDraft(question)
          setAsked(null)
        },
      },
    )
  }

  function restart() {
    setMessages([])
    setTurns([])
    setAsked(null)
    ask.reset()
  }

  return (
    <>
      <PageHeader
        title={t("assistant.title", "Assistant")}
        description={t("assistant.subtitle", "Ask about your projects, and have it do the looking")}
      />

      {availability.isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {availability.data?.available === false && (
        <EmptyState
          icon={Sparkles}
          title={t("assistant.noModel.title", "No model is configured here")}
          message={t(
            "assistant.noModel.message",
            "The assistant needs a provider to speak through, and this installation has not been given one. The tools themselves are unaffected — a connected client still reaches every one of them.",
          )}
        />
      )}

      {availability.data?.available === true && (
        <div className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-4">
            {entries.length === 0 && !asked && <Opening onPick={send} />}

            <AssistantTranscript
              entries={entries}
              turns={turns}
              pending={pending}
              busy={ask.isPending}
              onConfirm={send}
            />

            {asked && (
              <div className="flex flex-col gap-2.5">
                <p className="border-l-[3px] border-primary pl-3 font-display text-[15px] leading-snug font-semibold whitespace-pre-wrap">
                  {asked}
                </p>
                <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t("assistant.working", "Working — it may look a few things up first.")}</span>
                </div>
              </div>
            )}

            {ask.isError && (
              <p className="rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
                {t("assistant.failed", "That did not get through. Your question is back in the box — send it again.")}
              </p>
            )}

            <div ref={bottom} />
          </div>

          {/* Sticky rather than pinned to a scroll container: this layout scrolls the document, and a
              composer that stays where somebody's attention is between turns is the whole point. The
              negative margins cancel the layout's own padding so the rule reaches the true edges, the
              same trick PageHeader plays at the top. */}
          <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t bg-background px-4 pt-3 pb-3.5">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-2">
              <Textarea
                value={draft}
                rows={2}
                placeholder={t("assistant.placeholder", "Ask about your projects, issues, boards or sprints…")}
                disabled={ask.isPending}
                className="min-h-14 resize-y text-sm"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    send(draft)
                  }
                }}
              />
              <div className="flex items-center gap-2.5">
                {messages.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={restart} disabled={ask.isPending}>
                    {t("assistant.restart", "New conversation")}
                  </Button>
                )}
                <span className="ml-auto hidden text-[11px] text-ink-4 sm:inline">
                  {t("assistant.hint", "Enter sends · Shift+Enter for a new line")}
                </span>
                <Button onClick={() => send(draft)} disabled={ask.isPending || draft.trim().length === 0}>
                  {ask.isPending ? t("assistant.asking", "Asking…") : t("assistant.ask", "Ask")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * What to ask, for somebody who has never asked anything. Three openings rather than a paragraph
 * about what an assistant is — the useful thing to know is that it can look things up *in here*,
 * which a person learns in one press and not from being told.
 */
function Opening({ onPick }: { onPick: (question: string) => void }) {
  const { t } = useLanguage()

  const openings = [
    t("assistant.opening.one", "Which projects am I on, and what is open in them?"),
    t("assistant.opening.two", "Show me every issue assigned to me that is not done."),
    t("assistant.opening.three", "What is on the board right now, by column?"),
  ]

  return (
    <div className="pt-6 pb-2">
      <h2 className="mb-1.5 font-display text-lg font-semibold tracking-[-0.02em]">
        {t("assistant.opening.title", "Ask about your own work")}
      </h2>
      <p className="mb-4 max-w-[62ch] text-[13.5px] leading-relaxed text-secondary-foreground">
        {t(
          "assistant.opening.body",
          "It reads and writes as you — the same projects, the same permissions, nothing more. Anything that removes or overwrites is shown to you first, and waits.",
        )}
      </p>
      <div className="flex flex-col items-start gap-2">
        {openings.map((opening) => (
          <button
            key={opening}
            type="button"
            className="rounded-lg border bg-card px-3 py-2 text-left text-[13px] text-secondary-foreground transition-colors hover:border-primary hover:text-foreground"
            onClick={() => onPick(opening)}
          >
            {opening}
          </button>
        ))}
      </div>
    </div>
  )
}
