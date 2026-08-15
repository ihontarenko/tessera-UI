import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Plug, Unplug } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { MemberChip } from "@/components/MemberChip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import {
  fetchAgentConnections,
  fetchConnectionInfo,
  revokeAgentConnection,
} from "@/api/agentAuthorization"

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
 *
 * ⚠️ **Measured width, and the identity block is one line.** It was a full-bleed page whose "You" card
 * put two facts at opposite ends of a two-thousand-pixel row, with the reader's eye crossing the
 * monitor to pair a label with its value. Nothing here is wide data; the page is sized to its content.
 */
export function AccountSettingsPage() {
  const { data: member, isLoading } = useCurrentMember()

  return (
    <>
      <PageHeader title="Account" description="Who you are here, and how to connect a client" />

      <div className="max-w-3xl space-y-5 pt-3">
        <section className="space-y-2">
          {isLoading && <Skeleton className="h-10 w-64" />}

          {!isLoading && member && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <MemberChip member={member} subtitle={member.email} />
                <code className="text-[11px] text-muted-foreground">{member.subject}</code>
              </div>

              {/* ⚠️ What you hold, not what you are called. `systemRole` used to be shown here and is
                  not shown anywhere now: it is a role, it gates nothing on the server, and a role above
                  ADMIN would give the most powerful person the mildest word. A list of permissions
                  cannot go stale that way — it says exactly what is true. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                  Installation-wide
                </span>
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
              </div>
            </>
          )}
        </section>

        <McpConnectionSection />
        <ConnectedClientsSection />
      </div>
    </>
  )
}

/**
 * The clients you have actually connected, and the switch that ends one.
 *
 * ⚠️ **This is the half that makes handing out a month-long credential defensible.** Ending a connection
 * is immediate rather than eventual: every protocol call checks its connection still exists, so a client
 * stops on its next call rather than when its current token happens to expire.
 *
 * Absent entirely when nothing is connected. An empty list with a heading above it is a section about
 * nothing, and this page's point is the instructions above it.
 */
function ConnectedClientsSection() {
  const queryClient = useQueryClient()
  const { data: connections } = useQuery({
    queryKey: ["agent-connections"],
    queryFn: fetchAgentConnections,
  })

  const revoke = useMutation({
    mutationFn: revokeAgentConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-connections"] }),
  })

  if (!connections || connections.length === 0) {
    return null
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <header className="flex items-center gap-2">
        <Unplug className="size-4" />
        <h3 className="font-medium">Connected clients</h3>
      </header>

      <ul className="divide-y">
        {connections.map((connection) => (
          <li key={connection.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm">{connection.clientName}</span>
                {!connection.active && (
                  <Badge variant="outline" className="text-[11px]">
                    ended
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                approved {formatMoment(connection.issuedAt)}
                {connection.lastUsedAt
                  ? ` · last used ${formatMoment(connection.lastUsedAt)}`
                  : " · never used"}
              </p>
            </div>

            {connection.active && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => revoke.mutate(connection.id)}
                disabled={revoke.isPending}
              >
                Disconnect
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatMoment(moment: string) {
  return new Date(moment).toLocaleString()
}

type ClientKind = "claude-code" | "claude-desktop" | "codex" | "chatgpt"

const CLIENTS: Array<{ value: ClientKind; label: string }> = [
  { value: "claude-code", label: "Claude Code" },
  { value: "claude-desktop", label: "Claude Desktop" },
  { value: "codex", label: "Codex CLI" },
  { value: "chatgpt", label: "ChatGPT" },
]

/**
 * How to point a Model Context Protocol client at this installation.
 *
 * ⚠️ **The endpoint is asked of the server, never written down and never the page's own origin.** A URL
 * in a settings file is wrong on somebody's staging installation and stays wrong quietly; the browser's
 * origin was the next best thing and is wrong in *development*, where the interface is a dev server on
 * 5050 and the protocol is served on 8100. What the server answers is also exactly what its discovery
 * documents publish — and a client configured with a different origin refuses the connection itself,
 * before Tessera is ever asked.
 *
 * ⚠️ **Every command here was read out of the tool's own `--help`, not recalled.** A setup instruction
 * that is subtly wrong is worse than none: the reader trusts it, pastes it, and debugs their
 * installation rather than the documentation. Where a client has no command — ChatGPT adds connectors
 * through its interface — this says so and gives the click-path instead of inventing a CLI.
 */
function McpConnectionSection() {
  const [client, setClient] = useState<ClientKind>("claude-code")
  const { data: connectionInfo } = useQuery({
    queryKey: ["mcp-connection-info"],
    queryFn: fetchConnectionInfo,
    staleTime: Infinity,
  })

  // Until the server answers, the page's own origin is the better guess than an empty box — it is right
  // in every deployment and wrong only in development, which is the one place somebody knows both ports.
  const endpoint = connectionInfo?.serverUrl ?? `${window.location.origin}/api/mcp`

  const instructions: Record<ClientKind, { hint: string; snippet: string; label: string }> = {
    "claude-code": {
      label: "Terminal",
      hint: "Adds it to this machine. Use --scope project to commit it to .mcp.json for the whole team, or --scope user for every project you open.",
      snippet: `claude mcp add --transport http tessera ${endpoint}`,
    },
    "claude-desktop": {
      label: "claude_desktop_config.json",
      hint: "Settings → Developer → Edit Config, then restart Claude Desktop.",
      snippet: JSON.stringify(
        { mcpServers: { tessera: { type: "http", url: endpoint } } },
        null,
        2,
      ),
    },
    codex: {
      label: "Terminal",
      hint: "Writes the server into ~/.codex/config.toml.",
      snippet: `codex mcp add tessera --url ${endpoint}`,
    },
    chatgpt: {
      label: "No command — it is added in the interface",
      hint: "ChatGPT adds MCP servers as connectors rather than from a terminal: Settings → Connectors → Add custom connector, then paste the server URL below. It needs an installation this browser can reach from ChatGPT's servers, so a localhost URL will not work — use the deployed address.",
      snippet: endpoint,
    },
  }

  const current = instructions[client]

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <header className="flex items-center gap-2">
        <Plug className="size-4" />
        <h3 className="font-medium">Connect a client</h3>
      </header>

      <p className="text-sm text-muted-foreground">
        Tessera speaks the Model Context Protocol, so a client can read your projects, raise issues,
        move them through the workflow, comment, and plan sprints. It acts <strong>as you</strong>: it
        can do exactly what you can do, in exactly the projects you belong to, and nothing else.
      </p>

      <CopyableBlock label="Server URL" value={endpoint} />

      <div className="space-y-2 pt-1">
        <SegmentedControl
          segments={CLIENTS}
          value={client}
          onChange={setClient}
          ariaLabel="Client"
        />
        <p className="text-xs text-muted-foreground">{current.hint}</p>
        <CopyableBlock label={current.label} value={current.snippet} multiline={client === "claude-desktop"} />
      </div>

      <div className="space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">You will be asked to sign in, and then to approve.</strong>{" "}
          The client opens your browser, you sign in to Identity as usual, and Tessera shows you one screen
          naming the client and the address on this machine its code will be sent to. Approving it is what
          creates the connection — nothing is issued to a client nobody said yes to, and there is nothing
          here to copy but the URL above.
        </p>
        <p>
          <strong className="text-foreground">The credential works here and nowhere else.</strong> It is
          signed by Tessera for this one endpoint, so it is not a token that can read the rest of the API,
          and it is not the token your browser holds. End it whenever you like — the client stops on its
          next call, not whenever its token would have expired.
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
        className={`overflow-x-auto rounded-md border bg-muted/40 p-2.5 font-mono text-xs ${
          multiline ? "" : "whitespace-pre-wrap break-all"
        }`}
      >
        {value}
      </pre>
    </div>
  )
}
