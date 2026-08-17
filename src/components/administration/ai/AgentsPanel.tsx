import { useState } from "react"
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plug,
  Power,
  Shield,
  ShieldCheck,
  Trash2,
  Unplug,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  useAgents,
  useDiscardAgent,
  useRenameAgent,
  useRevokeAgentConnection,
  useSetAgentAuthority,
  useSetAgentEnabled,
} from "@/hooks/useAiAdministration"
import type { AgentAuthority, AgentConnection, AgentSurface, AgentView } from "@/api/ai"
import { cn } from "@/lib/helpers"
import { AgentGrantsEditor } from "./AgentGrantsEditor"

/**
 * Every agent this installation has, what each may do, and which clients are holding a credential.
 *
 * **An agent is a persona, not a credential.** It has a name somebody chose, permissions, and an on/off
 * switch, and it can hold several clients at once — so disconnecting a laptop does not sign out a
 * desktop, and switching the agent off stops all of them without ending any.
 *
 * ⚠️ **The two switches on each row do different things and the screen has to say so.** *Enabled* is
 * whether it may act **at all**; *authority* is **how much**. Confusing them is how somebody restricts an
 * agent expecting it to stop, or switches it off expecting it to merely be careful.
 *
 * Rows are cards rather than a table on purpose: an agent has a nested list under it and a table with a
 * list in one cell is a table that has stopped being one.
 */
export function AgentsPanel({ surface = "everyone" }: { surface?: AgentSurface }) {
  const mine = surface === "mine"
  const agents = useAgents(surface)
  const discard = useDiscardAgent()

  if (agents.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  if (!agents.data || agents.data.length === 0) {
    return (
      <Alert>
        <Bot className="size-4" />
        <AlertTitle>{mine ? "You have no agents" : "No agent has ever connected"}</AlertTitle>
        <AlertDescription>
          {mine
            ? `One appears here the first time you approve a client against the protocol endpoint —
               nothing is created in advance, because an agent nobody connected is a switch with
               nothing behind it.`
            : `An agent appears here the first time somebody approves a client against the protocol
               endpoint. Nothing is created in advance, because an agent nobody connected is a switch
               with nothing behind it.`}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {agents.data.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          surface={surface}
          onDiscard={mine ? () => discard.mutate(agent.id) : undefined}
        />
      ))}
    </div>
  )
}

function AgentCard({
  agent,
  surface,
  onDiscard,
}: {
  agent: AgentView
  surface: AgentSurface
  onDiscard?: () => void
}) {
  const setEnabled = useSetAgentEnabled(surface)
  const setAuthority = useSetAgentAuthority(surface)
  const revoke = useRevokeAgentConnection(surface)

  // Held locally so the warning appears BEFORE the change rather than as a toast after it. Restricting
  // an agent that has been granted nothing leaves it able to do nothing, which is the honest behaviour
  // and exactly the thing somebody has to be told while they can still change their mind.
  const [confirmingRestrict, setConfirmingRestrict] = useState(false)

  // ⚠️ Closed by default, and the pane's query is gated on it: an installation with twenty agents
  // would otherwise resolve twenty owners' effective permission sets to fill panes nobody opened.
  const [grantsOpen, setGrantsOpen] = useState(false)

  const live = agent.connections.filter((connection) => !connection.revokedAt)
  const ended = agent.connections.filter((connection) => connection.revokedAt)

  function changeAuthority(authority: AgentAuthority) {
    setConfirmingRestrict(false)
    setAuthority.mutate({ agentId: agent.id, authority })
  }

  return (
    <section
      className={cn(
        "rounded-lg border p-4 transition-opacity",
        !agent.enabled && "border-dashed opacity-70",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Bot className="size-4 shrink-0 text-primary" />
            <AgentName agent={agent} surface={surface} />
            <AuthorityChip authority={agent.authority} />
            {!agent.enabled && (
              <Badge variant="outline" className="text-[11px]">
                switched off
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {agent.connectionCount === 0
              ? "no live client"
              : `${agent.connectionCount} live client${agent.connectionCount === 1 ? "" : "s"}`}
            {" · "}
            {agent.lastActiveAt
              ? `last acted ${formatDistanceToNow(new Date(agent.lastActiveAt), { addSuffix: true })}`
              : "has never acted"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* ⚠️ Labelled, not a bare toggle. "Enabled" and "restricted" are two switches a few
              centimetres apart that mean at all and how much; an unlabelled one invites the wrong. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Power className="size-3.5" />
            May act
            <Switch
              checked={agent.enabled}
              disabled={setEnabled.isPending}
              onCheckedChange={(enabled) => setEnabled.mutate({ agentId: agent.id, enabled })}
            />
          </label>

          {/* ⚠️ Offered only on somebody's own, and never on the administration screen. Discarding
              somebody else's agent is indistinguishable afterwards from their having done it, and the
              switch beside it stops one just as completely while leaving it possible to explain. */}
          {onDiscard && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Discard ${agent.name}`}
              onClick={onDiscard}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </header>

      <div className="mt-3 space-y-3">
        <AuthorityControl
          agent={agent}
          pending={setAuthority.isPending}
          confirming={confirmingRestrict}
          grantsOpen={grantsOpen}
          onToggleGrants={() => setGrantsOpen((open) => !open)}
          onRestrictRequested={() => setConfirmingRestrict(true)}
          onCancel={() => setConfirmingRestrict(false)}
          onChange={changeAuthority}
        />

        {agent.authority === "RESTRICTED" && (
          <AgentGrantsEditor surface={surface} agentId={agent.id} expanded={grantsOpen} />
        )}

        {agent.connections.length > 0 && (
          <ul className="divide-y rounded-md border">
            {[...live, ...ended].map((connection) => (
              <li
                key={connection.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {connection.revokedAt ? (
                    <Unplug className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Plug className="size-3.5 shrink-0 text-primary" />
                  )}
                  <span className={cn("truncate", connection.revokedAt && "text-muted-foreground")}>
                    {connection.clientName}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {describeUsage(connection)}
                  </span>
                </div>

                {!connection.revokedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate({ agentId: agent.id, connectionId: connection.id })
                    }
                  >
                    Disconnect
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/**
 * What the agent is called, and the one place it can be corrected.
 *
 * <h2>⚠️ Why a rename has to be offered at all</h2>
 *
 * An agent is named after the client that first connected to it, and a client's name is a **claim it
 * made about itself** during registration — one it may not have made. A client that sent nothing is
 * called *An unnamed client*, and that string is then baked into the agent, the connections and every
 * record either of them touches. The registry is durable now, so it stops happening; renaming is what
 * fixes the ones it already happened to.
 *
 * ⚠️ Escape cancels and an empty box is refused — an agent with no name at all is a row nobody can
 * point at, which is the state this control exists to get out of, not into.
 */
function AgentName({ agent, surface }: { agent: AgentView; surface: AgentSurface }) {
  const rename = useRenameAgent(surface)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  function save() {
    const wanted = draft.trim()

    setEditing(false)

    if (wanted !== "" && wanted !== agent.name) {
      rename.mutate({ agentId: agent.id, name: wanted })
    }
  }

  if (editing) {
    return (
      <Input
        className="h-7 max-w-[240px] text-sm"
        value={draft}
        autoFocus
        maxLength={120}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            save()
          }
          if (event.key === "Escape") {
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      title="Rename"
      className="group inline-flex min-w-0 items-center gap-1.5 font-medium"
      onClick={() => {
        setDraft(agent.name)
        setEditing(true)
      }}
    >
      <span className="truncate">{agent.name}</span>
      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

/**
 * The half that decides how much, with its consequence stated before the click.
 *
 * ⚠️ **Restricting is offered behind a confirmation and switching back is not.** The two directions are
 * not symmetrical: one can leave an agent unable to do anything until somebody grants it something, and
 * the other only ever restores what its owner already holds.
 */
function AuthorityControl({
  agent,
  pending,
  confirming,
  grantsOpen,
  onToggleGrants,
  onRestrictRequested,
  onCancel,
  onChange,
}: {
  agent: AgentView
  pending: boolean
  confirming: boolean
  grantsOpen: boolean
  onToggleGrants: () => void
  onRestrictRequested: () => void
  onCancel: () => void
  onChange: (authority: AgentAuthority) => void
}) {
  if (confirming) {
    return (
      <Alert>
        <ShieldCheck className="size-4" />
        <AlertTitle>It will hold nothing until you grant it something</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            A restricted agent acts with its own permissions, capped by yours. It has none yet, so from
            its next call it can do nothing — which its owner will read as a broken connection unless
            you grant it something on the access screen.
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => onChange("RESTRICTED")}>
              Restrict it anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Leave it as it is
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {agent.authority === "RESTRICTED"
          ? "Holds its own permissions, and never more than its owner holds."
          : "Acts with everything its owner can do, and follows them into new projects."}
      </p>

      <div className="flex items-center gap-1">
        {agent.authority === "RESTRICTED" && (
          <Button size="sm" variant="ghost" onClick={onToggleGrants}>
            {grantsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {grantsOpen ? "Hide what it holds" : "Set what it holds"}
          </Button>
        )}

        {agent.authority === "RESTRICTED" ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => onChange("INHERITED")}>
            Give it its owner's access
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={onRestrictRequested}>
            Restrict it
          </Button>
        )}
      </div>
    </div>
  )
}

/** Quiet for the default, coloured for the exception — see the same chip on the account screen. */
function AuthorityChip({ authority }: { authority: AgentAuthority }) {
  const restricted = authority === "RESTRICTED"

  return (
    <span
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

function describeUsage(connection: AgentConnection) {
  if (connection.revokedAt) {
    return `ended ${formatDistanceToNow(new Date(connection.revokedAt), { addSuffix: true })}`
  }

  if (!connection.lastUsedAt) {
    return "never used"
  }

  return `used ${formatDistanceToNow(new Date(connection.lastUsedAt), { addSuffix: true })}`
}
