import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Info, Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  useAddAiPreferenceValue,
  useAiPreferences,
  useChangeAiPreferenceValue,
  useDiscardAiPreferenceValue,
  usePutAiPreferenceValueInForce,
  useRestoreAiPreferenceValue,
} from "@/hooks/useAiAdministration"
import type { AiPreference, AiPreferenceValue } from "@/api/ai"
import { cn } from "@/lib/helpers"

/**
 * What the assistant is told before every conversation.
 *
 * **The prompt is content, and content does not belong in a deploy.** It is rewritten by whoever is
 * watching how the assistant actually answers — a different person, on a different day, from whoever
 * ships a release — so every wording is a row in `ai_preferences` and an edit lands on the next
 * question.
 *
 * **Several wordings, one in force** — deliberately the shape the provider tab already has, because it
 * is the same situation: keeping the long prompt while trying the short one, and switching back with a
 * press rather than a paste. What the build ships is what a fresh database is *seeded from*; after that
 * these rows are the only thing anything reads.
 *
 * ⚠️ **This decides what the model is asked to do — never what it may do.** Every call is checked
 * against the asking person's permissions whatever the prompt says, and the catalogue the model is
 * offered is already cut to what they hold. A prompt that granted something would be a wish.
 */
export function PromptPanel({ canAdminister }: { canAdminister: boolean }) {
  const preferences = useAiPreferences(canAdminister)

  if (!canAdminister) {
    return (
      <Alert>
        <Info className="size-4" />
        <AlertTitle>Reading is not administering</AlertTitle>
        <AlertDescription>
          Whoever changes this decides what the model is told to do with every permission every caller
          holds, so it is its own permission. Ask an administrator for <code>ai:administer</code>.
        </AlertDescription>
      </Alert>
    )
  }

  const declared = preferences.data ?? []

  if (!preferences.isLoading && declared.length === 0) {
    return (
      <Alert>
        <Sparkles className="size-4" />
        <AlertTitle>Nothing is declared</AlertTitle>
        <AlertDescription>
          Settings appear here as the backend declares them, beside whatever they are settings for.
          Nothing has declared one yet.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {declared.map((setting) => (
        <SettingEditor key={setting.name} setting={setting} />
      ))}
    </div>
  )
}

/** One declared setting — its wordings, which one is in force, and everything done to them. */
function SettingEditor({ setting }: { setting: AiPreference }) {
  const inForce = setting.values.find((stored) => stored.inForce)

  const [opened, setOpened] = useState<string | null>(inForce?.id ?? null)
  const [adding, setAdding] = useState(false)

  const add = useAddAiPreferenceValue()

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-display text-base font-semibold tracking-[-0.01em]">{setting.title}</h3>
          <code className="font-mono text-[11px] text-muted-foreground">{setting.name}</code>
        </div>
        <Button variant="outline" size="sm" disabled={adding} onClick={() => setAdding(true)}>
          Add a wording
        </Button>
      </header>

      <p className="max-w-3xl text-sm text-muted-foreground">{setting.description}</p>

      {adding && (
        <NewWording
          busy={add.isPending}
          onCancel={() => setAdding(false)}
          onSave={(draft) =>
            add.mutate(
              { name: setting.name, ...draft },
              {
                onSuccess: (created) => {
                  setAdding(false)
                  setOpened(created.id)
                },
              },
            )
          }
        />
      )}

      <div className="space-y-2">
        {setting.values.map((stored) => (
          <Wording
            key={stored.id}
            stored={stored}
            multiline={setting.multiline}
            opened={opened === stored.id}
            onToggle={() => setOpened(opened === stored.id ? null : stored.id)}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * One stored wording, shut or open.
 *
 * Shut it is a row: its name, whether it is the one in force, and whether it still says what the build
 * ships. Open it is the text — which is a page of prose, and three of those on one screen is a screen
 * nobody can find anything on.
 */
function Wording({
  stored,
  multiline,
  opened,
  onToggle,
}: {
  stored: AiPreferenceValue
  multiline: boolean
  opened: boolean
  onToggle: () => void
}) {
  const change = useChangeAiPreferenceValue()
  const putInForce = usePutAiPreferenceValueInForce()
  const restore = useRestoreAiPreferenceValue()
  const discard = useDiscardAiPreferenceValue()

  const [label, setLabel] = useState(stored.label)
  const [draft, setDraft] = useState(stored.value)

  // ⚠️ Keyed on the stored text rather than on every render: a background refetch answering the same
  // string does not run this, so it cannot take somebody's half-typed paragraph away. What it does
  // catch is the value actually changing under the screen — a save, or a restore.
  useEffect(() => {
    setDraft(stored.value)
  }, [stored.value])

  useEffect(() => {
    setLabel(stored.label)
  }, [stored.label])

  const busy = change.isPending || putInForce.isPending || restore.isPending || discard.isPending
  const changed = draft !== stored.value || label !== stored.label

  return (
    <article className={cn("rounded-lg border bg-card", stored.inForce && "border-primary")}>
      <header className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium"
          onClick={onToggle}
        >
          {opened ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          {stored.label}
        </button>

        <Badge variant={stored.inForce ? "default" : "secondary"}>
          {stored.inForce ? "In force" : "Idle"}
        </Badge>

        {/* Said only about a wording that came from the build — one somebody wrote here has no shipped
            text to have drifted from, and "edited" would be meaningless on it. */}
        {stored.shippedKey && !stored.asShipped && <Badge variant="outline">Edited</Badge>}

        <span className="flex-1" />

        {!stored.inForce && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => putInForce.mutate(stored.id)}
          >
            Put in force
          </Button>
        )}
      </header>

      {opened && (
        <div className="space-y-3 border-t p-3">
          <Input
            className="max-w-sm"
            value={label}
            disabled={busy}
            onChange={(event) => setLabel(event.target.value)}
          />

          {multiline ? (
            <Textarea
              className="min-h-96 font-mono text-xs leading-relaxed"
              value={draft}
              disabled={busy}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <Input value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {stored.inForce ? "This is what the assistant is told." : "Stored, and not being used."}
              {changed && " · unsaved"}
            </span>
            <span className="flex-1" />

            {/* Only where there is a shipped text to go back to, and only where the row has actually
                drifted from it — otherwise the press would do nothing visible and read as broken. */}
            {stored.shippedKey && !stored.asShipped && (
              <Button variant="ghost" disabled={busy} onClick={() => restore.mutate(stored.id)}>
                Back to shipped
              </Button>
            )}

            {/* ⚠️ The one in force cannot be deleted — the server refuses it too, so the assistant is
                never left with nothing to be told. */}
            {!stored.inForce && (
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() => discard.mutate(stored.id)}
              >
                Delete
              </Button>
            )}

            <Button
              variant="ghost"
              disabled={busy || !changed}
              onClick={() => {
                setDraft(stored.value)
                setLabel(stored.label)
              }}
            >
              Undo
            </Button>

            <Button
              disabled={busy || !changed}
              onClick={() => change.mutate({ id: stored.id, label, value: draft })}
            >
              {change.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

/** A wording somebody writes here rather than one the build shipped. */
function NewWording({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean
  onCancel: () => void
  onSave: (draft: { label: string; value: string }) => void
}) {
  const [label, setLabel] = useState("")
  const [value, setValue] = useState("")

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <Input
        className="max-w-sm"
        value={label}
        placeholder="Ours, Terse, For support…"
        disabled={busy}
        onChange={(event) => setLabel(event.target.value)}
      />

      <Textarea
        className="min-h-64 font-mono text-xs leading-relaxed"
        value={value}
        placeholder="What the assistant should be told."
        disabled={busy}
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Added idle — putting it in force is a second press.
        </span>
        <span className="flex-1" />
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={busy || label.trim().length === 0 || value.trim().length === 0}
          onClick={() => onSave({ label, value })}
        >
          Add it
        </Button>
      </div>
    </div>
  )
}
