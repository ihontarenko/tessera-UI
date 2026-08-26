import { Link2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@jmouse/ui"

/**
 * Copies the durable Markdown reference to this issue.
 *
 * <h2>⚠️ Why this control has to exist</h2>
 *
 * <p>An issue's permanent id is what a reference stored anywhere outside this tracker resolves through
 * — a wiki page, another product's description, a link somebody sends. It was reachable from the
 * protocol (`issues_get` answers a ready-made `reference`) and from nowhere at all in a browser, which
 * quietly made the whole feature agents-only: a person could not write one because nothing on any
 * screen showed them the id.
 *
 * <h2>⚠️ It copies the whole Markdown link, not the bare token</h2>
 *
 * <p>`issue:9f3a21` on a clipboard is one paste away from being dropped into a field that expects a
 * key, where it resolves to nothing and looks like a typo. `[TES-42](issue:9f3a21)` is only ever pasted
 * into prose — the one place it means anything — and anybody who wanted the token can read it out of
 * what they pasted.
 *
 * <p>The label is the key <em>as it stands now</em>, deliberately: it is the fallback text a reader sees
 * where the reference cannot be resolved, so it should read as a name rather than as an identifier.
 */
export function CopyReferenceAction({ issueKey, hash }: { issueKey: string; hash: string }) {
  const reference = `[${issueKey}](issue:${hash})`

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference)
      toast.success("Reference copied", { description: reference })
    } catch {
      // ⚠️ The clipboard needs a secure context and can be refused outright. Saying "copied" when
      // nothing was is worse than saying nothing, so the text goes in the message to be taken by hand.
      toast.error(`Could not copy it. The reference is ${reference}`)
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={copy} title={`Copy ${reference}`}>
      <Link2 className="mr-1 size-3.5" /> Copy reference
    </Button>
  )
}
