import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileManager } from "@jmouse/files"
import { PageHeader } from "@/components/PageHeader"
import { SegmentedControl } from "@/components/SegmentedControl"
import { TesseraMarkdown } from "@/components/markdown/TesseraMarkdown"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import {
  INSTALLATION_OWNER,
  fetchRoots,
  memberOwner,
  tesseraFileLibrary,
} from "@/lib/fileLibraryPort"

type Tree = "shared" | "mine"

/**
 * Files — everything this installation keeps, on the library's own manager (`TSSR-0106`).
 *
 * <h2>⚠️ Two trees, and they are genuinely two rather than two branches</h2>
 *
 * <p>`storage_directories` is keyed `(owner_key, path)`, and Tessera uses both halves:
 *
 * <ul>
 *   <li><strong>Shared</strong> — `tessera/attachments`, the installation's, and <strong>machine-made</strong>.
 *       Attachments land in `issues/&lt;PROJECT&gt;/&lt;ISSUE&gt;` as they are uploaded and an assistant's
 *       files land in `ai/mcp/&lt;subject&gt;`. Nobody arranges it, so nothing here offers to;
 *   <li><strong>My files</strong> — `tessera/library`, a root of the reader's own, theirs to arrange.
 * </ul>
 *
 * <p>⚠️ **Two mounts rather than one.** `FileManager` takes a single `rootId` and browses one tree, which
 * is right: a manager showing two roots side by side would have to invent a node above them that is in
 * no tree and that no route can answer about. A switch between them is the honest shape, and it is also
 * how the two differ in what they permit.
 *
 * <h2>⚠️ Whether the toolbar is offered is not read off the caller's global permissions</h2>
 *
 * <p>`file:write` is held **at a project** for the shared tree and **at `@SELF`** for a personal one —
 * never installation-wide for an ordinary member — so a check against the global set would hide the
 * controls from everybody including the people who may use them. The server is the authority: the
 * actions are offered, and a refusal comes back as a notice naming what was refused. The one thing said
 * up front is that the shared tree is not arrangeable **by anybody**, which is a property of the tree
 * rather than of the reader.
 */
export function FilesPage() {
  const [tree, setTree] = useState<Tree>("shared")
  const { data: member } = useCurrentMember()

  // ⚠️ Memoised: the manager loads the tree in an effect keyed on the port, so a fresh object every
  // render would refetch on every render.
  const port = useMemo(() => tesseraFileLibrary(), [])

  const shared = useQuery({
    queryKey: ["file-roots", INSTALLATION_OWNER],
    queryFn: () => fetchRoots(INSTALLATION_OWNER),
  })

  const mine = useQuery({
    queryKey: ["file-roots", member?.id],
    queryFn: () => fetchRoots(memberOwner(member!.id)),
    enabled: Boolean(member?.id),
  })

  const active = tree === "shared" ? shared : mine
  const rootId = active.data?.[0]?.id ?? null

  /**
   * ⚠️ **Switching trees has to clear the address, and the first cut of this page did not.**
   *
   * The manager keeps where it is in the URL hash (`#folder=<id>`) so a folder can be linked to — and it
   * reads that hash on mount, remount included. So remounting on the other root left it opening a folder
   * belonging to the tree just left: an empty tree pane beside a full file list, which reads as a bug in
   * the tree rather than as an address pointing somewhere else.
   */
  function switchTree(next: Tree) {
    window.history.replaceState(window.history.state, "", window.location.pathname)
    setTree(next)
  }

  return (
    <>
      <PageHeader
        title="Files"
        description={
          tree === "shared"
            ? "Everything attached to an issue, filed under the issue it belongs to"
            : "Your own folders — nobody else can see them"
        }
        actions={
          <SegmentedControl<Tree>
            segments={[
              { value: "shared", label: "Shared" },
              { value: "mine", label: "My files" },
            ]}
            value={tree}
            onChange={switchTree}
            ariaLabel="Which tree"
          />
        }
      />

      <FileManager
        // ⚠️ Keyed on the tree, so switching remounts rather than showing the previous tree's folders
        // under the new root while the second query settles.
        key={tree}
        rootId={active.isLoading ? null : rootId}
        port={port}
        rootLabel={tree === "shared" ? "Attachments" : "My files"}
        layoutStorageKey="tessera.files.view"
        // The shared tree is minted from issue keys and nothing offers to rearrange it — a folder
        // renamed there would be re-made under its old name by the next upload.
        canWrite={tree === "mine"}
        // ⚠️ The one thing about looking at a file that stays this product's, and it is a setting rather
        // than a screen: which kinds can be drawn, the text ceiling and the `blob:` mechanics all belong
        // to the package.
        renderMarkdown={(markdown) => <TesseraMarkdown markdown={markdown} />}
        onNotice={(message) => toast.error(message)}
        emptyHint={
          tree === "shared"
            ? "Nothing filed here yet. Attach a file to an issue and it appears under that issue."
            : "Nothing here yet. Make a folder, or drag a file into one."
        }
      />
    </>
  )
}
