import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Plug, Shield, ShieldCheck, Smile, Unplug } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { MemberAvatar } from "@/components/MemberAvatar"
import { AvatarPickerDialog } from "@/components/account/AvatarPickerDialog"
import { memberName } from "@/lib/memberDisplay"
import { cn } from "@/lib/helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import {
  type AgentAuthority,
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
  const [isPickingAvatar, setPickingAvatar] = useState(false)

  return (
    <>
      <PageHeader title="Account" description="Who you are here, and how to connect a client" />

      <div className="max-w-3xl space-y-5 pt-3">
        <section className="space-y-2">
          {isLoading && <Skeleton className="h-10 w-64" />}

          {!isLoading && member && (
            <>
              {/* ⚠️ A larger avatar than anywhere else in the product, on purpose. This is the one screen
                  where the face is the subject rather than a label beside a name, and it is what makes
                  the button next to it read as "change that" rather than as a stray setting. */}
              <div className="flex items-center gap-4">
                <MemberAvatar member={member} className="size-16 shrink-0" />

                <div className="min-w-0 space-y-0.5">
                  <div className="truncate text-base font-medium">{memberName(member)}</div>
                  {member.email && (
                    <div className="truncate text-sm text-muted-foreground">{member.email}</div>
                  )}
                  <code className="block truncate text-[11px] text-muted-foreground">{member.subject}</code>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto shrink-0"
                  onClick={() => setPickingAvatar(true)}
                >
                  <Smile className="size-4" />
                  Change avatar
                </Button>
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

      <AvatarPickerDialog open={isPickingAvatar} onOpenChange={setPickingAvatar} />
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* The AGENT is the title, not the client. The client is how it connected; the agent is
                    the thing with permissions and a switch, and it is what a record's badge names —
                    so the two screens say the same word about the same thing. */}
                <span className="truncate text-sm font-medium">{connection.agentName}</span>

                {/* Only where they differ. They are the same on the day a client first connects,
                    because that is what the agent gets named after, and printing it twice is noise. */}
                {connection.clientName !== connection.agentName && (
                  <span className="truncate text-xs text-muted-foreground">
                    via {connection.clientName}
                  </span>
                )}

                <AuthorityChip authority={connection.authority} />

                {/* Two different endings, and telling them apart is the whole reason both are here:
                    one is this client, the other is every client of this agent at once. */}
                {!connection.agentEnabled && (
                  <Badge variant="outline" className="text-[11px]">
                    agent off
                  </Badge>
                )}
                {connection.agentEnabled && !connection.active && (
                  <Badge variant="outline" className="text-[11px]">
                    ended
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
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

/**
 * What this agent may do, in two words.
 *
 * ⚠️ **Shown on every row, including the ordinary one.** "Full access" reads as noise right up until
 * somebody is deciding whether to disconnect a client, and then it is the only thing on the line that
 * matters. Printing it only when restricted would leave the reader to infer the dangerous case from an
 * absence.
 *
 * Quiet for the default and coloured for the exception, so the list scans as *these are normal, that one
 * is not* rather than as a wall of chips.
 */
function AuthorityChip({ authority }: { authority: AgentAuthority }) {
  const restricted = authority === "RESTRICTED"

  return (
    <span
      title={
        restricted
          ? "Holds its own permissions, and never more than you hold"
          : "Acts with everything you can do, and follows you into new projects"
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-[10px] font-medium",
        restricted
          ? "border-primary/30 bg-primary/[0.08] text-foreground/80"
          : "border-border text-muted-foreground",
      )}
    >
      {restricted ? <ShieldCheck className="size-2.5 text-primary" /> : <Shield className="size-2.5" />}
      {restricted ? "Restricted" : "Full access"}
    </span>
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

      {/* ⚠️ This used to say a client "acts as you: exactly what you can do, and nothing else". That
          stopped being true when an agent gained an authority of its own — a restricted one does
          strictly less. The ceiling is the half worth stating, because it is the half that holds in
          both cases: never more than you, sometimes less. */}
      <p className="text-sm text-muted-foreground">
        Tessera speaks the Model Context Protocol, so a client can read your projects, raise issues,
        move them through the workflow, comment, and plan sprints. It acts as an <strong>agent</strong>{" "}
        working for you — never able to do more than you can, in no project you do not belong to, and
        less than that wherever the agent has been restricted.
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
