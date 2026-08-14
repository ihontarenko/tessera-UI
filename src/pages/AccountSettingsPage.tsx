import { useState } from "react"
import { Check, Copy, Plug } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { MemberChip } from "@/components/MemberChip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SegmentedControl } from "@/components/SegmentedControl"
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
      </div>
    </>
  )
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
 * ⚠️ **The endpoint is derived from the page's own origin, never configured.** A URL written into a
 * settings file is a URL that is wrong on somebody's staging installation and stays wrong quietly —
 * whereas the browser is already talking to the right server, so asking it is both simpler and correct
 * everywhere.
 *
 * ⚠️ **Every command here was read out of the tool's own `--help`, not recalled.** A setup instruction
 * that is subtly wrong is worse than none: the reader trusts it, pastes it, and debugs their
 * installation rather than the documentation. Where a client has no command — ChatGPT adds connectors
 * through its interface — this says so and gives the click-path instead of inventing a CLI.
 */
function McpConnectionSection() {
  const [client, setClient] = useState<ClientKind>("claude-code")
  const endpoint = `${window.location.origin}/api/mcp`

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
        className={`overflow-x-auto rounded-md border bg-muted/40 p-2.5 font-mono text-xs ${
          multiline ? "" : "whitespace-pre-wrap break-all"
        }`}
      >
        {value}
      </pre>
    </div>
  )
}
