import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@jmouse/ui"
import { useProjectUpdate } from "@/components/projects/settings/useProjectUpdate"
import { fetchIssueKeyPreview, type ProjectResponse } from "@/api/projects"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

const CUSTOM = "CUSTOM"

/**
 * The shape of this project's issue keys, with the next one shown as it is chosen.
 *
 * ⚠️ **Changing the format changes the next key and no existing one.** Keys are never regenerated —
 * an issue's key is in links, in branch names and in other people's notes — so a project that switches
 * from `TIC-9` to `TIC-0010` holds both shapes forever. The existing key is shown beside the preview so
 * that divergence is visible while the choice is being made rather than discovered in a list afterwards.
 *
 * ⚠️ **The preview is the project's real next sequence**, not a made-up 42. The question being asked is
 * "what will my keys look like", and an example built from a number this project is not on answers a
 * different one.
 *
 * ⚠️ **A custom pattern must contain `${sequence}`**, and the server refuses it otherwise: the
 * per-project counter is the only thing making a key unique (ADR-0003), so a pattern without it would
 * quietly mint duplicates.
 */
export function IssueKeyFormatEditor({
  project,
  canAdminister,
}: {
  project: ProjectResponse
  canAdminister: boolean
}) {
  const [keyStrategy, setKeyStrategy] = useState(project.keyStrategy)
  const [keyPattern, setKeyPattern] = useState(project.keyPattern ?? "")

  const mutation = useProjectUpdate(project, "Key format updated")

  // Debounced: the preview is a server round trip and this is a text field somebody types a pattern into.
  const debouncedPattern = useDebouncedValue(keyPattern, 300)

  const { data: preview } = useQuery({
    queryKey: ["project", project.id, "key-preview", keyStrategy, debouncedPattern],
    queryFn: () =>
      fetchIssueKeyPreview(project.id, keyStrategy, keyStrategy === CUSTOM ? debouncedPattern : null),
    enabled: canAdminister && (keyStrategy !== CUSTOM || debouncedPattern.trim().length > 0),
    retry: false,
  })

  const changed =
    keyStrategy !== project.keyStrategy ||
    (keyStrategy === CUSTOM && keyPattern.trim() !== (project.keyPattern ?? "").trim())

  if (!canAdminister) {
    return null
  }

  return (
    <div className="max-w-xl space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="settings-key-format">Issue key format</Label>
        <Select value={keyStrategy} onValueChange={setKeyStrategy}>
          <SelectTrigger id="settings-key-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(preview?.formats ?? []).map((format) => (
              <SelectItem key={format.name} value={format.name}>
                {format.example ? `${label(format.name)} — ${format.example}` : label(format.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {keyStrategy === CUSTOM && (
        <div className="space-y-1.5">
          <Label htmlFor="settings-key-pattern">Pattern</Label>
          <Input
            id="settings-key-pattern"
            value={keyPattern}
            placeholder="${key}-${year}-${sequence:000}"
            onChange={(event) => setKeyPattern(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Variables: <code>{"${key}"}</code>, <code>{"${sequence}"}</code>, <code>{"${year}"}</code>,{" "}
            <code>{"${month}"}</code>, <code>{"${day}"}</code>. The zeros in{" "}
            <code>{"${sequence:0000}"}</code> set the width. <code>{"${sequence}"}</code> has to be in
            there — it is what makes a key unique.
          </p>
        </div>
      )}

      <div className="rounded-md border p-3 text-sm">
        <p className="text-xs font-medium text-muted-foreground">The next issue raised here</p>
        <p className="font-mono">{preview?.nextKey ?? "—"}</p>

        {preview?.existingKey && (
          <p className="pt-1 text-xs text-muted-foreground">
            An issue already here is <code className="font-mono">{preview.existingKey}</code>. Existing
            keys are never regenerated, so both shapes will be in this project from now on.
          </p>
        )}
      </div>

      <Button
        size="sm"
        disabled={!changed || mutation.isPending}
        onClick={() =>
          mutation.mutate({
            keyStrategy,
            keyPattern: keyStrategy === CUSTOM ? keyPattern.trim() : project.keyPattern,
          })
        }
      >
        {mutation.isPending ? "Saving…" : "Save key format"}
      </Button>
    </div>
  )
}

/** `YEAR_MONTH_SEQUENCE` → `Year month sequence`. The server names formats; naming them twice invites drift. */
function label(name: string) {
  const words = name.toLowerCase().split("_").join(" ")

  return words.charAt(0).toUpperCase() + words.slice(1)
}
