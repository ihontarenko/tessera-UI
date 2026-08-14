import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Info, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiErrorMessage } from "@/api/errors"
import { fetchRenameImpact, type FilterMention, type UsageReport } from "@/api/configurationAdministration"

/**
 * The pieces every Administration section is built from.
 *
 * They are together because they are one idea said in four places: **say what would happen, then let it
 * happen**. Editing the configuration is in place and shared — a rename reaches every project at once
 * and there is no draft to undo — so what replaces safety-by-copying is knowing beforehand, and knowing
 * beforehand has to look the same on every screen or nobody learns to trust it.
 */

/** The frame every section shares: what it is, and one line saying what editing it does. */
export function AdministrationSection({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold tracking-[-0.01em]">{title}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

/** Shown in place of the controls when the member may look but not change anything. */
export function ReadOnlyNotice() {
  return (
    <Alert>
      <Info className="size-4" />
      <AlertTitle>You are reading this, not editing it</AlertTitle>
      <AlertDescription>
        Changing the configuration is installation-wide, so it needs <code>configuration:administer</code>
        . Everything on these screens is what every project runs on today.
      </AlertDescription>
    </Alert>
  )
}

/** A usage report as a sentence — the same words the refusal would use, because it is the same object. */
export function UsageLine({ usage }: { usage: UsageReport | undefined }) {
  if (!usage) {
    return <span className="text-xs text-muted-foreground">checking…</span>
  }

  if (usage.holders.length === 0) {
    return <span className="text-xs text-muted-foreground">Nothing holds this — it can be deleted.</span>
  }

  return (
    <ul className="space-y-1">
      {usage.holders.map((holder) => (
        <li key={holder.kind} className="text-xs">
          <span className="font-medium">{holder.phrase}</span>
          {holder.names.length > 0 && (
            <span className="text-muted-foreground"> — {holder.names.join(", ")}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Delete, with what holds the row shown first.
 *
 * ⚠️ The usage is fetched when the dialog opens rather than kept beside every row: it is several
 * queries per row, and a screen that runs them for thirty statuses nobody is deleting is a screen that
 * costs a page load to answer a question nobody asked.
 */
export function DeleteWithUsage({
  name,
  noun,
  usageQueryKey,
  fetchUsage,
  onDelete,
  onDeleted,
  disabled,
}: {
  name: string
  noun: string
  usageQueryKey: unknown[]
  fetchUsage: () => Promise<UsageReport>
  onDelete: () => Promise<unknown>
  onDeleted: () => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  const { data: usage } = useQuery({ queryKey: usageQueryKey, queryFn: fetchUsage, enabled: open })

  const remove = useMutation({
    mutationFn: onDelete,
    onSuccess: () => {
      toast.success(`${name} deleted`)
      setOpen(false)
      onDeleted()
    },
    // The server refuses with the same report shown above, so the toast and the panel agree.
    onError: (error) => toast.error(apiErrorMessage(error, `Could not delete ${name}`)),
  })

  const held = (usage?.holders.length ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-label={`Delete ${name}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            The configuration is shared, so this {noun} disappears from every project at once. There is no
            undo.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">What holds it</p>
          <UsageLine usage={usage} />
        </div>

        {held && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>This will be refused</AlertTitle>
            <AlertDescription>
              Deleting is only possible once nothing holds it. Move the work off it first.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Which filters mention the name being changed.
 *
 * ⚠️ Renaming does not break a filter in any way that shows. `issue.type.name == 'Bug'` goes on parsing,
 * goes on running, and quietly matches nothing — which is why this is shown and why nothing rewrites it.
 * What somebody's filter means is theirs.
 */
export function RenameWarning({ currentName, nextName }: { currentName: string; nextName: string }) {
  const changed = nextName.trim().length > 0 && nextName.trim() !== currentName

  const { data: mentions = [] } = useQuery({
    queryKey: ["administration", "rename-impact", currentName],
    queryFn: () => fetchRenameImpact(currentName),
    enabled: changed,
  })

  if (!changed || mentions.length === 0) {
    return null
  }

  return (
    <Alert>
      <AlertTriangle className="size-4" />
      <AlertTitle>
        {mentions.length} filter{mentions.length === 1 ? "" : "s"} mention “{currentName}”
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          A filter compares on the name, so after the rename these keep working and match nothing. Nothing
          here rewrites them.
        </p>
        <ul className="space-y-0.5">
          {mentions.map((mention: FilterMention) => (
            <li key={`${mention.source}-${mention.id}`} className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{mention.source === "builtIn" ? "shipped" : "saved"}</Badge>
              <span className="text-xs font-medium">{mention.name}</span>
              <code className="text-[11px] text-muted-foreground">{mention.expression}</code>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/**
 * The dialog every create/edit form sits in — open state, submit, pending label, and nothing else.
 *
 * The fields are the caller's, because they are the only part that differs; writing this frame six times
 * is how six screens come to disagree about where the Cancel button is.
 */
export function CatalogDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  canSubmit,
  isPending,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  submitLabel: string
  canSubmit: boolean
  isPending: boolean
  onSubmit: () => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) {
              onSubmit()
            }
          }}
        >
          {children}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The mutation shape every section repeats: toast on both ends, and refresh the catalogs the whole
 * application reads from.
 *
 * ⚠️ `["configuration"]` is invalidated on every write, and that is not over-eager. Every picker in the
 * product — the issue dialog's type list, the board's status pills, project settings' scheme panels — is
 * built from that one payload, so a status renamed here is stale everywhere until it is dropped.
 *
 * `TVariables` defaults to `void` so the common case — a closure that already knows what it is saving —
 * is `mutate()` with no argument. The one caller that genuinely varies per call (reordering, which sends
 * a whole list) infers it from its own `mutationFn`.
 */
export function useCatalogMutation<TResult, TVariables = void>({
  mutationFn,
  success,
  failure,
  onDone,
}: {
  mutationFn: (variables: TVariables) => Promise<TResult>
  success: string
  failure: string
  /** Handed what the write returned, so a caller that needs the new row's id does not re-fetch for it. */
  onDone?: (result: TResult) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: ["configuration"] })
      void queryClient.invalidateQueries({ queryKey: ["administration"] })
      onDone?.(result)
    },
    onError: (error) => toast.error(apiErrorMessage(error, failure)),
  })
}
