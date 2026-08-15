import { useState } from "react"
import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToolCalls, useUsageTotals } from "@/hooks/useAiAdministration"

/**
 * What has been called, and how much of it.
 *
 * Two tables answering one question at two grains: the trail says *what just happened*, the totals say
 * *what keeps happening*. Both keep the outcome in view rather than summing it away — a caller whose
 * calls are ninety per cent refusals is the single most useful thing either table says, and a total by
 * caller alone would hide exactly that.
 *
 * ⚠️ **An empty trail is two different facts** — nothing has been called, or nothing records what is
 * called. They look identical and mean opposite things, so the overview asks the server which it is and
 * this panel says so rather than leaving somebody to assume the reassuring one. Tessera records the
 * counters and not the per-call trail: what a tool *did* is already in the issue's own activity log,
 * written by the same services a person's edit goes through.
 */
export function ActivityPanel({ trailRecorded }: { trailRecorded: boolean }) {
  const [caller, setCaller] = useState("")
  const calls = useToolCalls({ caller: caller || undefined, limit: 100 })
  const totals = useUsageTotals()

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold tracking-[-0.01em]">Recent calls</h3>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Every call, newest first, with the verdict it ended as.
            </p>
          </div>
          {trailRecorded && (
            <Input
              className="w-full sm:w-72"
              value={caller}
              placeholder="Narrow to one caller…"
              onChange={(event) => setCaller(event.target.value)}
            />
          )}
        </header>

        {!trailRecorded ? (
          <Alert>
            <Info className="size-4" />
            <AlertTitle>No per-call trail is recorded on this installation</AlertTitle>
            <AlertDescription>
              That is not the same as nothing having been called — the list would be empty either way,
              so it is said here rather than left to be assumed. What a tool <em>changed</em> is in the
              issue&rsquo;s own activity log, written by the same services a person&rsquo;s edit goes
              through; the totals below are what counts the calls themselves.
            </AlertDescription>
          </Alert>
        ) : (calls.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            A trail is being recorded — there is simply nothing in it yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Where</TableHead>
                <TableHead className="w-40">Outcome</TableHead>
                <TableHead className="w-24">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(calls.data ?? []).map((call) => (
                <TableRow key={call.operationId}>
                  <TableCell className="text-xs">{new Date(call.at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{call.qualifiedName}</TableCell>
                  <TableCell className="text-sm">
                    {call.callerId}
                    {/* An agent acting for somebody is two identities, and which one a refusal was
                        measured against is the whole question when somebody asks why a call failed. */}
                    {call.actingSubject !== call.callerId && (
                      <div className="text-xs text-muted-foreground">for {call.actingSubject}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{call.scopeLabel ?? "—"}</TableCell>
                  <TableCell>
                    <Outcome outcome={call.outcome} />
                  </TableCell>
                  <TableCell className="text-sm">{call.affectedCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-4">
        <header className="space-y-1">
          <h3 className="font-display text-base font-semibold tracking-[-0.01em]">Totals</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            By caller, action and outcome — the outcome stays in the key rather than being summed away,
            because a caller whose calls are mostly refusals is the thing worth seeing.
          </p>
        </header>

        {(totals.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing counted yet. Totals appear as soon as anything is called.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caller</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-40">Outcome</TableHead>
                <TableHead className="w-20">Calls</TableHead>
                <TableHead className="w-24">Tokens</TableHead>
                <TableHead className="w-44">Last</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(totals.data ?? []).map((total) => (
                <TableRow key={`${total.callerId}-${total.qualifiedName}-${total.outcome}`}>
                  <TableCell className="text-sm">{total.callerId}</TableCell>
                  <TableCell className="font-mono text-xs">{total.qualifiedName}</TableCell>
                  <TableCell>
                    <Outcome outcome={total.outcome} />
                  </TableCell>
                  <TableCell className="text-sm">{total.calls}</TableCell>
                  <TableCell className="text-sm">{total.tokens > 0 ? total.tokens : "—"}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(total.lastCalledAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

/**
 * The verdict or the refusal reason, as a badge.
 *
 * Two colours and not three: a call either did what it was asked or it did not, and inventing a middle
 * shade for previews and suppressed duplicates would give somebody a colour to learn rather than a word
 * to read.
 */
function Outcome({ outcome }: { outcome: string }) {
  const succeeded = outcome === "SUCCEEDED" || outcome === "PREVIEWED" || outcome === "SUPPRESSED"

  return (
    <Badge variant={succeeded ? "secondary" : "destructive"}>
      {outcome.toLowerCase().replace(/_/g, " ")}
    </Badge>
  )
}
