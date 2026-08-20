import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { CheckCircle2, CircleAlert, HelpCircle, Loader2 } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Textarea,
} from "@jmouse/ui"
import { FilterHelpPanel } from "@/components/board/FilterHelpPanel"
import { useLanguage } from "@/context/LanguageContext"
import { apiErrorMessage } from "@/api/errors"
import { cn } from "@/lib/helpers"
import {
  createSavedFilter,
  previewFilter,
  updateSavedFilter,
  type SavedFilterView,
  type SaveFilterRequest,
} from "@/api/savedFilters"

/** Long enough that a pause reads as "stopped typing", short enough to feel live. */
const PREVIEW_DEBOUNCE_MILLISECONDS = 450

/** Matches the server's own cap (BoardFilterEvaluator.MAXIMUM_EXPRESSION_LENGTH). */
const MAXIMUM_EXPRESSION_LENGTH = 1024

/**
 * Write or rewrite a saved filter (ADR-0008 Phase 4's editor).
 *
 * The expression is validated by the **server**, not here: parsing jME in the client would mean a
 * second implementation of the grammar that could disagree with the one that actually runs. Preview
 * answers "valid, matches 4 of 37" against the caller's own board, so the count shown is the count
 * they would really get — and an invalid expression is reported inline rather than as a failed save.
 *
 * A preset is never edited; the panel opens this in "copy" mode instead, so using a built-in as a
 * starting point does not need a different flow.
 */
export function BoardFilterEditor({
  projectId,
  savedFilter,
  initialExpression,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string
  /** The filter being rewritten, or `null` to write a new one. */
  savedFilter: SavedFilterView | null
  /** Seeds the expression field when writing a new filter — from the toggles, or from a preset. */
  initialExpression: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (savedFilter: SavedFilterView) => void
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [expression, setExpression] = useState("")
  const [shareWithProject, setShareWithProject] = useState(false)
  const [debouncedExpression, setDebouncedExpression] = useState("")
  const [helpOpen, setHelpOpen] = useState(false)

  const expressionField = useRef<HTMLTextAreaElement>(null)

  // Re-seed whenever the dialog opens, so reopening after a cancel never shows the abandoned draft.
  useEffect(() => {
    if (!open) {
      return
    }

    setName(savedFilter?.name ?? "")
    setDescription(savedFilter?.description ?? "")
    setExpression(savedFilter?.expression ?? initialExpression)
    setShareWithProject(savedFilter?.visibility === "PROJECT")
    setHelpOpen(false)
  }, [open, savedFilter, initialExpression])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedExpression(expression.trim()), PREVIEW_DEBOUNCE_MILLISECONDS)
    return () => clearTimeout(timer)
  }, [expression])

  const { data: preview, isFetching: previewing } = useQuery({
    queryKey: ["filter-preview", projectId, debouncedExpression],
    queryFn: () => previewFilter(projectId, debouncedExpression),
    enabled: open && debouncedExpression.length > 0,
  })

  const saveMutation = useMutation({
    mutationFn: (request: SaveFilterRequest) =>
      savedFilter === null
        ? createSavedFilter(projectId, request)
        : updateSavedFilter(projectId, savedFilter.id, request),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters", projectId] })
      onSaved(saved)
      onOpenChange(false)
    },
    onError: (error) =>
      toast.error(apiErrorMessage(error, t("filter.editor.saveFailed", "Could not save the filter"))),
  })

  /** Drop a snippet in at the caret, so the help panel builds an expression rather than just describing one. */
  function insertSnippet(snippet: string) {
    const field = expressionField.current

    if (!field) {
      setExpression((current) => `${current}${snippet}`)
      return
    }

    const { selectionStart, selectionEnd } = field
    setExpression((current) => current.slice(0, selectionStart) + snippet + current.slice(selectionEnd))

    // Restore focus after React has written the new value, or the caret jumps to the end.
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(selectionStart + snippet.length, selectionStart + snippet.length)
    })
  }

  const trimmedName = name.trim()
  const trimmedExpression = expression.trim()
  const expressionTooLong = trimmedExpression.length > MAXIMUM_EXPRESSION_LENGTH
  const previewIsCurrent = debouncedExpression === trimmedExpression && !previewing

  const canSave =
    trimmedName.length > 0 &&
    trimmedExpression.length > 0 &&
    !expressionTooLong &&
    !saveMutation.isPending &&
    // Refuse to store something the engine has already said it cannot run — the server would reject it
    // anyway, and failing here keeps the reason next to the field that caused it.
    !(previewIsCurrent && preview?.valid === false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-lg", helpOpen && "sm:max-w-3xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {savedFilter === null
              ? t("filter.editor.createTitle", "New filter")
              : t("filter.editor.editTitle", "Edit filter")}

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6"
              aria-expanded={helpOpen}
              aria-label={t("filter.help.toggle", "Filter syntax help")}
              title={t("filter.help.toggle", "Filter syntax help")}
              onClick={() => setHelpOpen((current) => !current)}
            >
              <HelpCircle className={cn("size-4", helpOpen ? "text-primary" : "text-muted-foreground")} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className={cn("gap-5", helpOpen ? "grid sm:grid-cols-[1fr_20rem]" : "block")}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-name">{t("filter.editor.name", "Name")}</Label>
              <Input
                id="filter-name"
                value={name}
                maxLength={128}
                placeholder={t("filter.editor.namePlaceholder", "Release blockers")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-description">{t("filter.editor.description", "Description")}</Label>
              <Input
                id="filter-description"
                value={description}
                maxLength={500}
                placeholder={t("filter.editor.descriptionPlaceholder", "Optional")}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-expression">{t("filter.editor.expression", "Expression")}</Label>
              <Textarea
                id="filter-expression"
                ref={expressionField}
                value={expression}
                rows={5}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder="issue.assignee == currentMember and issue.resolution is null"
                onChange={(event) => setExpression(event.target.value)}
              />
              <PreviewStatus
                expression={trimmedExpression}
                tooLong={expressionTooLong}
                previewing={previewing || !previewIsCurrent}
                preview={previewIsCurrent ? preview : undefined}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={shareWithProject}
                onChange={(event) => setShareWithProject(event.target.checked)}
              />
              {t("filter.editor.shareWithProject", "Share with everyone on this project")}
            </label>
          </div>

          {helpOpen && (
            <div className="min-w-0">
              <Separator className="mb-3 sm:hidden" />
              <FilterHelpPanel onInsert={insertSnippet} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              saveMutation.mutate({
                name: trimmedName,
                description: description.trim() === "" ? null : description.trim(),
                expression: trimmedExpression,
                visibility: shareWithProject ? "PROJECT" : "PRIVATE",
              })
            }
          >
            {saveMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            {t("common.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The one line under the expression field: whether it runs, and how much of the board it selects. */
function PreviewStatus({
  expression,
  tooLong,
  previewing,
  preview,
}: {
  expression: string
  tooLong: boolean
  previewing: boolean
  preview: { valid: boolean; message: string | null; matchedCount: number | null; totalCount: number } | undefined
}) {
  const { t } = useLanguage()

  if (tooLong) {
    return (
      <Status tone="invalid" icon={<CircleAlert className="size-3.5" />}>
        {t("filter.editor.tooLong", "A filter may be at most {max} characters", {
          max: MAXIMUM_EXPRESSION_LENGTH,
        })}
      </Status>
    )
  }

  if (expression.length === 0) {
    return (
      <Status tone="muted">
        {t("filter.editor.emptyHint", "A filter asks a yes/no question about one issue.")}
      </Status>
    )
  }

  if (previewing || !preview) {
    return (
      <Status tone="muted" icon={<Loader2 className="size-3.5 animate-spin" />}>
        {t("filter.editor.checking", "Checking…")}
      </Status>
    )
  }

  if (!preview.valid) {
    return (
      <Status tone="invalid" icon={<CircleAlert className="size-3.5" />}>
        {preview.message ?? t("filter.editor.invalid", "This filter could not be run.")}
      </Status>
    )
  }

  return (
    <Status tone="valid" icon={<CheckCircle2 className="size-3.5" />}>
      {t("filter.editor.matches", "Valid — matches {matched} of {total} cards", {
        matched: preview.matchedCount ?? 0,
        total: preview.totalCount,
      })}
    </Status>
  )
}

function Status({
  tone,
  icon,
  children,
}: {
  tone: "valid" | "invalid" | "muted"
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs",
        tone === "valid" && "text-emerald-600 dark:text-emerald-400",
        tone === "invalid" && "text-destructive-ink",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {icon}
      <span>{children}</span>
    </p>
  )
}
