import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import { flattenKiwiTree, getKiwiTree } from "@/api/kiwi"
import { isKiwiUnreachable } from "@/api/kiwiClient"
import {
  Alert,
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@jmouse/ui"
/**
 * Which Kiwi section this project's wiki lives in (KW-10; KW-1 §3).
 *
 * <h2>⚠️ Picked by hand, from Kiwi's own tree, and two projects may point at the same branch</h2>
 *
 * Kiwi's categories are **bare** — no owner column, nothing naming which product a section belongs to
 * (KW-1 §2). Ownership inside Kiwi would have made *"only this person may see section X"* a rule each
 * product could interpret differently; instead there is one authority, and the consumer says which
 * branch is its own. A shared handbook — two projects, one branch — is a real arrangement and is
 * allowed.
 *
 * <h2>⚠️ Kiwi being unreachable is a normal state, and this picker says so</h2>
 *
 * Kiwi is a runtime dependency of a screen inside Tessera, so it will sometimes not be there. What that
 * must **not** produce is a spinner that never ends, or an empty picker reading as *"Kiwi has no
 * sections"* — that one is worse than an error, because it is a plausible lie that would have somebody
 * conclude the wiki is empty and go and make a second one.
 *
 * <h2>⚠️ Only readable sections are offered</h2>
 *
 * A node with `readable: false` is a breadcrumb — an ancestor of a branch this administrator was
 * granted, carried so the tree has a path down to it. Choosing one as a root would configure the wiki
 * to a section nobody, including the person choosing it, can open.
 */
export function KiwiRootPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (categoryId: string | null) => void
}) {
  const tree = useQuery({
    queryKey: ["kiwi-tree"],
    queryFn: getKiwiTree,
    // ⚠️ No retry. Kiwi being down should cost one control and one honest sentence, not a settings
    // screen that hangs while it tries three times.
    retry: false,
  })

  if (tree.isLoading) {
    return <Skeleton className="h-9 w-64" />
  }

  if (tree.isError) {
    const unreachable = isKiwiUnreachable(tree.error)

    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          {unreachable
            ? "Kiwi is down or unreachable, so its sections cannot be listed. Nothing here is lost — the wiki is stored there, and this setting is only which section it lives in."
            : "Kiwi refused to list its sections for you. That usually means you have not been granted any — somebody who administers Kiwi's access can give you one."}
        </AlertDescription>
      </Alert>
    )
  }

  const sections = flattenKiwiTree(tree.data ?? []).filter(({ node }) => node.readable)

  if (sections.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Kiwi has no section you can use as a root — either it has none yet, or none has been granted to
        you. Both are somebody's job over there rather than something to fix here.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <Select value={value ?? ""} onValueChange={(next) => onChange(next || null)}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Not configured — pick a section" />
        </SelectTrigger>
        <SelectContent>
          {sections.map(({ node, depth }) => (
            <SelectItem key={node.id} value={node.id}>
              {"— ".repeat(depth)}
              {node.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ⚠️ Said out loud, because it is the thing an administrator would otherwise learn from a
          support ticket: the wiki is stored in another product, and who can read it is decided there. */}
      <p className="text-[11px] text-muted-foreground">
        The pages live in Kiwi. Who may read them is Kiwi's answer, given per section — choosing a root
        here does not grant anybody anything.
      </p>
    </div>
  )
}
