import { useState } from "react"
import { Badge, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@jmouse/ui"
import { usePublishedTools } from "@/hooks/useAiAdministration"

/**
 * Every action the mechanism publishes — to a connected protocol client and to the in-app assistant
 * alike.
 *
 * **One catalogue and not two**, and this is the screen where somebody can see that it is actually
 * true: `/api/mcp` and `/assistant` are looking at this list and no other.
 *
 * The three flags are what a reader scans for — whether it only looks, whether it can destroy, and
 * whether it is pinned to one project — and the permission column is the answer to "why can this agent
 * not do that", which is the question people actually arrive with.
 */
export function CataloguePanel() {
  const actions = usePublishedTools()
  const [filter, setFilter] = useState("")
  const [opened, setOpened] = useState<string | null>(null)

  const needle = filter.trim().toLowerCase()
  const visible = (actions.data ?? []).filter(
    (action) =>
      needle.length === 0 ||
      action.publishedName.toLowerCase().includes(needle) ||
      action.title.toLowerCase().includes(needle) ||
      action.requiredPermission.toLowerCase().includes(needle),
  )

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold tracking-[-0.01em]">Published actions</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            One catalogue, reached by a connected client and by the assistant alike. Select a row to
            read its description and the schema it accepts.
          </p>
        </div>
        <Input
          className="w-full sm:w-72"
          value={filter}
          placeholder="Filter by name, title or permission…"
          onChange={(event) => setFilter(event.target.value)}
        />
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Action</TableHead>
            <TableHead>What it does</TableHead>
            <TableHead className="w-44">Costs</TableHead>
            <TableHead className="w-48">Nature</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((action) => (
            <TableRow
              key={action.publishedName}
              className="cursor-pointer"
              onClick={() =>
                setOpened(opened === action.publishedName ? null : action.publishedName)
              }
            >
              <TableCell className="align-top">
                <div className="font-mono text-xs font-medium">{action.publishedName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {action.qualifiedName}
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="text-sm">{action.title}</div>
                {opened === action.publishedName && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                    <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
                      {JSON.stringify(action.inputSchema, null, 2)}
                    </pre>
                  </div>
                )}
              </TableCell>
              <TableCell className="align-top font-mono text-xs">
                {action.requiredPermission}
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-wrap gap-1">
                  {action.readOnly && <Badge variant="secondary">reads</Badge>}
                  {!action.readOnly && !action.destructive && <Badge variant="outline">writes</Badge>}
                  {action.destructive && <Badge variant="destructive">destroys</Badge>}
                  {action.scopeConfined && <Badge variant="outline">one project</Badge>}
                  {/* Forwarded to a server this installation connected to, rather than answered here —
                      worth showing, because "why did that fail" has a different answer for each. */}
                  {action.origin === "REMOTE" && <Badge variant="outline">remote</Badge>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No published action has that in its name, title or permission.
        </p>
      )}
    </section>
  )
}
