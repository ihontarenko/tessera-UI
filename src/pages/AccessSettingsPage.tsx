import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getAccessOverview,
  setRoleBundle,
  type AccessOverview,
  type BundleEntryView,
  type RoleView,
} from "@/api/access"
import { apiErrorMessage } from "@/api/errors"

/**
 * The installation's access screen.
 *
 * ⚠️ **What it edits is in force on the next request.** The engine resolves every route from these rows;
 * `policy/tessera.jmp` is only what a fresh installation was born with. That is the whole point of the
 * screen — authorization changes without a deploy — and the reason it sits behind `access:administer`.
 *
 * ⚠️ **And what it edits on a *declared* role does not last.** The seed rewrites the bundle of every role
 * the document declares whenever that document changes, so an edit to one survives until somebody edits
 * the file. The banner says so, because the alternative is an administrator discovering it after a
 * deploy and concluding the screen is broken.
 *
 * The three tabs are three different questions, and keeping them apart is deliberate: what a role
 * *means*, who *holds* one, and what somebody was given or refused *personally*. The last is where a
 * surprise usually lives — a deny beats every role that grants it, from anywhere, so a person who
 * "should" be able to do something and cannot is almost always in that table.
 */
export function AccessSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["access", "overview"], queryFn: getAccessOverview })

  return (
    <>
      <PageHeader
        title="Access"
        description="What each role carries, and who holds what"
      />

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isLoading && data && <AccessTabs overview={data} />}
    </>
  )
}

function AccessTabs({ overview }: { overview: AccessOverview }) {
  return (
    <Tabs defaultValue="roles" className="space-y-4">
      <TabsList>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="holdings">Who holds what</TabsTrigger>
        <TabsTrigger value="personal">Personal grants</TabsTrigger>
      </TabsList>

      <TabsContent value="roles" className="space-y-6">
        {overview.roles.map((role) => (
          <RoleCard key={role.name} role={role} permissions={overview.permissions} />
        ))}
      </TabsContent>

      <TabsContent value="holdings">
        <RoleHoldings overview={overview} />
      </TabsContent>

      <TabsContent value="personal">
        <DirectHoldings overview={overview} />
      </TabsContent>
    </Tabs>
  )
}

/**
 * One role and everything it carries, as a switch per permission.
 *
 * A matrix rather than a picker: what matters when reading a role is what it does *not* carry, and a
 * list of only the granted lines cannot show that. `assignableAt` decides the scope every entry is
 * written at — a project role carries at `PROJECT`, the installation-wide one at `GLOBAL` — so there is
 * no second control for it, and nothing to get wrong.
 */
function RoleCard({ role, permissions }: { role: RoleView; permissions: AccessOverview["permissions"] }) {
  const queryClient = useQueryClient()
  const [carried, setCarried] = useState<Set<string>>(
    () => new Set(role.bundle.map((entry) => entry.permission)),
  )

  const original = useMemo(
    () => new Set(role.bundle.map((entry) => entry.permission)),
    [role.bundle],
  )

  const changed = carried.size !== original.size || [...carried].some((name) => !original.has(name))

  const save = useMutation({
    mutationFn: () => {
      const bundle: BundleEntryView[] = [...carried].map((permission) => ({
        permission,
        carriedAt: role.assignableAt,
      }))

      return setRoleBundle(role.name, bundle)
    },
    onSuccess: () => {
      toast.success(`${role.name} updated — in force on the next request`)
      void queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
      // Every project payload carries the caller's own permissions, and they may have just changed.
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  function toggle(permission: string) {
    setCarried((previous) => {
      const next = new Set(previous)
      if (next.has(permission)) {
        next.delete(permission)
      } else {
        next.add(permission)
      }
      return next
    })
  }

  return (
    <section className="rounded-lg border p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{role.name}</h3>
          <Badge variant="outline">assignable at {role.assignableAt}</Badge>
        </div>
        <Button size="sm" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </header>

      {role.declared && (
        <Alert className="mb-3">
          <AlertTitle>The policy document declares this role</AlertTitle>
          <AlertDescription>
            An edit here is in force immediately and is rewritten from{" "}
            <code>policy/tessera.jmp</code> the next time that file changes. For a permanent change, edit
            the document.
          </AlertDescription>
        </Alert>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {permissions.map((permission) => (
          <li key={permission.name} className="flex items-start gap-3 rounded-md border p-2">
            <Switch
              checked={carried.has(permission.name)}
              onCheckedChange={() => toggle(permission.name)}
              aria-label={permission.name}
            />
            <div className="min-w-0">
              <div className="truncate font-mono text-xs">{permission.name}</div>
              <div className="text-xs text-muted-foreground">{permission.description}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RoleHoldings({ overview }: { overview: AccessOverview }) {
  if (overview.roleHoldings.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nobody holds a role yet"
        message="A role is assigned when somebody is added to a project, or here for the installation-wide one."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Where</TableHead>
          <TableHead className="w-32">Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overview.roleHoldings.map((holding, index) => (
          <TableRow key={`${holding.member?.id ?? "gone"}-${holding.roleName}-${index}`}>
            <TableCell>
              {holding.member ? (
                <MemberChip member={holding.member} subtitle={holding.member.email} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  an account that no longer exists
                </span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">{holding.roleName}</TableCell>
            <TableCell>{describePlace(holding)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{holding.source}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * Personal allow and deny.
 *
 * ⚠️ **Deny wins over every role that grants it, from anywhere.** This is the table to read when
 * somebody insists they should be able to do something and cannot.
 */
function DirectHoldings({ overview }: { overview: AccessOverview }) {
  if (overview.directHoldings.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nobody has a personal grant"
        message="Everything anybody may do comes from a role. Personal allows and denies are set on a project's people screen."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Permission</TableHead>
          <TableHead className="w-24">Effect</TableHead>
          <TableHead>Where</TableHead>
          <TableHead>Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {overview.directHoldings.map((holding, index) => (
          <TableRow key={`${holding.member?.id ?? "gone"}-${holding.permission}-${index}`}>
            <TableCell>
              {holding.member ? (
                <MemberChip member={holding.member} subtitle={holding.member.email} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  an account that no longer exists
                </span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">{holding.permission}</TableCell>
            <TableCell>
              <Badge variant={holding.allowed ? "outline" : "destructive"}>
                {holding.allowed ? "allow" : "deny"}
              </Badge>
            </TableCell>
            <TableCell>{describePlace(holding)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{holding.reason}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Where a holding applies, named rather than identified — nobody recognises a project by its key column. */
function describePlace(holding: { scopeType: string; project: { key: string; name: string } | null }) {
  if (holding.project) {
    return (
      <span>
        <span className="font-mono text-xs">{holding.project.key}</span>{" "}
        <span className="text-muted-foreground">{holding.project.name}</span>
      </span>
    )
  }

  return <span className="text-xs text-muted-foreground">{holding.scopeType.toLowerCase()}</span>
}
