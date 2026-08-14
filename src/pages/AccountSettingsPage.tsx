import { useState } from "react"
import { Check, Copy, Plug } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { MemberChip } from "@/components/MemberChip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentMember } from "@/hooks/useCurrentMember"

/**
 * Who you are here, and how to reach Tessera from outside the browser.
 *
 * The account half is a read: Tessera holds a local `Member` row keyed on Identity's subject, and
 * seeing it is how somebody checks that the person the tracker knows is the person they signed in as.
 *
 * The connection half is the point. Tessera speaks the Model Context Protocol at `/api/mcp`, and the
 * one thing a person needs in order to use it is a URL — everything else the client discovers on its
 * own. Writing that down where somebody will look for it is the difference between a feature and a
 * feature nobody finds.
 */
export function AccountSettingsPage() {
  const { data: member, isLoading } = useCurrentMember()

  return (
    <>
      <PageHeader title="Account" description="Who you are here, and how to connect a client" />

      <div className="space-y-6">
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-medium">You</h3>

          {isLoading && <Skeleton className="h-10 w-64" />}

          {!isLoading && member && (
            <div className="space-y-3">
              <MemberChip member={member} subtitle={member.email} />
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Signed in as</dt>
                  <dd className="font-mono text-xs">{member.subject}</dd>
                </div>
                <div>
                  {/* ⚠️ What you hold, not what you are called. `systemRole` used to be shown here and
                      is not shown anywhere now: it is a role, it gates nothing on the server, and a
                      role above ADMIN would give the most powerful person the mildest word. A list of
                      permissions cannot go stale that way — it says exactly what is true. */}
                  <dt className="text-xs text-muted-foreground">Holds installation-wide</dt>
                  <dd className="flex flex-wrap gap-1">
                    {member.globalPermissions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        nothing — everything you can do is inside a project
                      </span>
                    ) : (
                      member.globalPermissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="font-mono text-[11px]">
                          {permission}
                        </Badge>
                      ))
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        <McpConnectionSection />
      </div>
    </>
  )
}

/**
 * How to point a Model Context Protocol client at this installation.
 *
 * ⚠️ **The endpoint is derived from the page's own origin, never configured.** A URL written into a
 * settings file is a URL that is wrong on somebody's staging installation and stays wrong quietly —
 * whereas the browser is already talking to the right server, so asking it is both simpler and correct
 * everywhere.
 */
function McpConnectionSection() {
  const endpoint = `${window.location.origin}/api/mcp`

  const snippet = JSON.stringify(
    { mcpServers: { tessera: { type: "http", url: endpoint } } },
    null,
    2,
  )

  return (
    <section className="rounded-lg border p-4">
      <header className="mb-3 flex items-center gap-2">
        <Plug className="size-4" />
        <h3 className="font-medium">Connect a client</h3>
      </header>

      <p className="mb-3 text-sm text-muted-foreground">
        Tessera speaks the Model Context Protocol, so a client — Claude Desktop, or anything else that
        speaks it — can read your projects, raise issues, move them through the workflow, comment, and
        plan sprints. It acts <strong>as you</strong>: it can do exactly what you can do, in exactly the
        projects you belong to, and nothing else.
      </p>

      <CopyableBlock label="Server URL" value={endpoint} />

      <p className="mt-4 mb-2 text-sm text-muted-foreground">
        Most clients take a small configuration file instead:
      </p>

      <CopyableBlock label="Configuration" value={snippet} multiline />

      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">You will be asked to sign in.</strong> The client opens
          your browser, you sign in to Identity as usual, and it comes back with its own token. Tessera
          never sees a password and you never paste one anywhere — there is nothing here to copy but the
          URL above.
        </p>
        <p>
          ⚠️ <strong className="text-foreground">A refusal is not a bug.</strong> The client is held to
          the same permissions you are: a project you do not belong to does not appear to it, and an
          action you may not take is refused with the reason. If it says a workflow move is not allowed,
          it will also be told which moves are — that is the tracker answering, not the client failing.
        </p>
      </div>
    </section>
  )
}

function CopyableBlock({
  label,
  value,
  multiline,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    // Long enough to read, short enough that the button is ready again before somebody needs it.
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <pre
        className={`overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs ${
          multiline ? "" : "whitespace-pre-wrap break-all"
        }`}
      >
        {value}
      </pre>
    </div>
  )
}
