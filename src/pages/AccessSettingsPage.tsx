import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/PageHeader"
import { EmptyState } from "@/components/EmptyState"
import { HighlightedCode } from "@/components/HighlightedCode"
import { MemberChip } from "@/components/MemberChip"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Input,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@jmouse/ui"
import {
  assignRole,
  getAccessOverview,
  getPolicyProjection,
  grantPermission,
  revokePermission,
  setRoleBundle,
  unassignRole,
  type AccessOverview,
  type BundleEntryView,
  type DirectHoldingView,
  type RoleHoldingView,
  type RoleView,
} from "@/api/access"
import { searchMembers } from "@/api/members"
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
 * The first three tabs are three different questions, and keeping them apart is deliberate: what a role
 * *means*, who *holds* one, and what somebody was given or refused *personally*. The third is where a
 * surprise usually lives — a deny beats every role that grants it, from anywhere, so a person who
 * "should" be able to do something and cannot is almost always in that table.
 *
 * ⚠️ **The fourth is all three at once, as a document.** Three lists are three things to hold in your
 * head, and *"who can do what here"* is one question — so the projection renders the rows back into the
 * policy language, read-only. It answers from the rows and never from `policy/tessera.jmp`, which is
 * only the seed and has drifted from them since the first edit made on this screen.
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
        <TabsTrigger value="projection">As a policy</TabsTrigger>
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

      {/* ⚠️ The other three tabs are three questions; this one is the answer to all of them at once,
          which is why it is last rather than first. Somebody comes here after reading a list and still
          not being able to say what is in force. */}
      <TabsContent value="projection">
        <PolicyProjectionTab />
      </TabsContent>
    </Tabs>
  )
}

/**
 * The whole authorization as a `.jmp` document, read-only (TSSR-20).
 *
 * ⚠️ **Rendered from the rows, never from `policy/tessera.jmp`.** The file is the seed; the engine reads
 * rows, and they part company the moment somebody saves a bundle on the first tab.
 */
function PolicyProjectionTab() {
  const projection = useQuery({ queryKey: ["access", "projection"], queryFn: getPolicyProjection })

  if (projection.isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  // ⚠️ A failed fetch must SAY SO, and this is the one tab where that is easy to get wrong: `data` is a
  // string, so the obvious `data ?? ""` renders an empty bordered box — a screen that reads as an
  // installation with no authorization at all rather than as a request that did not arrive.
  if (projection.isError || projection.data === undefined) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Could not render the policy"
        message="Nothing is wrong with the authorization itself — the other three tabs read it from a different route. This one either failed or is not there, which is what a backend older than the tab looks like."
        action={
          <Button size="sm" variant="outline" onClick={() => projection.refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  // ⚠️ Never empty when the route answers — `PolicyProjection.render` always writes its generated header
  // and the opening `policy "…" {`. So a body that does not open with that header is not a short policy,
  // it is something else arriving at status 200, and colouring it through the `.jmp` grammar would dress
  // whatever it is up as authorization.
  if (!projection.data.trimStart().startsWith("#")) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="That was not a policy"
        message="The route answered, but with something other than a rendered document. A rendered policy always carries its header, so something between here and the renderer replaced or dropped the body."
        action={
          <Button size="sm" variant="outline" onClick={() => projection.refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  // ⚠️ Highlighted through the `.jmp` grammar, which exists for exactly this document. A policy read as
  // undifferentiated grey is one whose `deny` lines get skimmed past, and a deny is the sharpest line in
  // the file.
  return <HighlightedCode code={projection.data} language="jmp" />
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
  return (
    <div className="space-y-4">
      <AssignRoleForm overview={overview} />
      {overview.roleHoldings.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nobody holds a role yet"
          message="A role is assigned when somebody is added to a project, or above for the installation-wide one."
        />
      ) : (
        <RoleHoldingsTable overview={overview} />
      )}
    </div>
  )
}

function RoleHoldingsTable({ overview }: { overview: AccessOverview }) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: (holding: RoleHoldingView) =>
      unassignRole(holding.member!.id, holding.roleName, holding.project?.id ?? null),
    onSuccess: () => {
      toast.success("Taken back")
      void queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Where</TableHead>
          <TableHead className="w-28">Source</TableHead>
          <TableHead className="w-24" />
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
            <TableCell>
              {/* An orphaned holding has no member to name, so there is nothing to address a
                  withdrawal to — clearing those is a database job, and saying so beats a button that
                  cannot work. */}
              {holding.member && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(holding)}
                >
                  Take back
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * Give somebody a role.
 *
 * ⚠️ **Where it may go is the role's own answer.** A role assignable at `PROJECT` needs a project and a
 * role assignable at `GLOBAL` refuses one, so the project field appears and disappears with the choice
 * rather than being always present and sometimes ignored. The server refuses both mistakes anyway; this
 * is so nobody has to be refused to find out.
 */
function AssignRoleForm({ overview }: { overview: AccessOverview }) {
  const queryClient = useQueryClient()
  const [memberId, setMemberId] = useState("")
  const [roleName, setRoleName] = useState("")
  const [projectId, setProjectId] = useState("")

  const { data: members } = useQuery({ queryKey: ["members"], queryFn: () => searchMembers() })

  const role = overview.roles.find((candidate) => candidate.name === roleName)
  const needsProject = role?.assignableAt === "PROJECT"
  const projects = knownProjects(overview)

  const assign = useMutation({
    mutationFn: () => assignRole(memberId, roleName, needsProject ? projectId : null),
    onSuccess: () => {
      toast.success("Given — in force on the next request")
      setMemberId("")
      setRoleName("")
      setProjectId("")
      void queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const ready = memberId !== "" && roleName !== "" && (!needsProject || projectId !== "")

  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">Give a role</h3>
      <div className="flex flex-wrap items-end gap-2">
        <PickerField label="Member" value={memberId} onChange={setMemberId}>
          {(members ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName ?? member.email ?? member.id}
            </option>
          ))}
        </PickerField>

        <PickerField label="Role" value={roleName} onChange={setRoleName}>
          {overview.roles.map((candidate) => (
            <option key={candidate.name} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </PickerField>

        {needsProject && (
          <PickerField label="Project" value={projectId} onChange={setProjectId}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} — {project.name}
              </option>
            ))}
          </PickerField>
        )}

        <Button size="sm" disabled={!ready || assign.isPending} onClick={() => assign.mutate()}>
          {assign.isPending ? "Giving…" : "Give"}
        </Button>
      </div>

      {role && !needsProject && (
        <p className="mt-2 text-xs text-muted-foreground">
          ⚠️ {role.name} is installation-wide — it applies everywhere, including projects nobody has
          made yet.
        </p>
      )}
    </section>
  )
}

/**
 * Personal allow and deny.
 *
 * ⚠️ **Deny wins over every role that grants it, from anywhere.** This is the table to read when
 * somebody insists they should be able to do something and cannot.
 */
function DirectHoldings({ overview }: { overview: AccessOverview }) {
  return (
    <div className="space-y-4">
      <GrantPermissionForm overview={overview} />
      {overview.directHoldings.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nobody has a personal grant"
          message="Everything anybody may do comes from a role, which is the healthy state. A personal grant is for the exception a role should not be reshaped around."
        />
      ) : (
        <DirectHoldingsTable overview={overview} />
      )}
    </div>
  )
}

/**
 * Hand one permission to one person, or take one away.
 *
 * ⚠️ **A deny wins over every role that grants it, from anywhere.** It is the sharpest instrument on
 * this screen and the reason the reason field is required: somebody reading this table in a year has
 * only that sentence to go on.
 */
function GrantPermissionForm({ overview }: { overview: AccessOverview }) {
  const queryClient = useQueryClient()
  const [memberId, setMemberId] = useState("")
  const [permission, setPermission] = useState("")
  const [projectId, setProjectId] = useState("")
  const [allowed, setAllowed] = useState(false)
  const [reason, setReason] = useState("")

  const { data: members } = useQuery({ queryKey: ["members"], queryFn: () => searchMembers() })

  const save = useMutation({
    mutationFn: () =>
      grantPermission(memberId, permission, allowed, projectId === "" ? null : projectId, reason),
    onSuccess: () => {
      toast.success(allowed ? "Allowed" : "Denied")
      setMemberId("")
      setPermission("")
      setReason("")
      void queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const ready = memberId !== "" && permission !== "" && reason.trim() !== ""

  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium">Allow or deny one person</h3>

      <div className="flex flex-wrap items-end gap-2">
        <PickerField label="Member" value={memberId} onChange={setMemberId}>
          {(members ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName ?? member.email ?? member.id}
            </option>
          ))}
        </PickerField>

        <PickerField label="Permission" value={permission} onChange={setPermission}>
          {overview.permissions.map((candidate) => (
            <option key={candidate.name} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </PickerField>

        {/* ⚠️ A personal grant may be made at either floor, unlike a role — "may do X here" and "may do
            X anywhere" are both sentences somebody legitimately wants to write. Empty means everywhere. */}
        <PickerField label="Where" value={projectId} onChange={setProjectId} emptyLabel="Everywhere">
          {knownProjects(overview).map((project) => (
            <option key={project.id} value={project.id}>
              {project.key} — {project.name}
            </option>
          ))}
        </PickerField>

        <div className="flex items-center gap-2 pb-1">
          <Switch checked={allowed} onCheckedChange={setAllowed} aria-label="allow" />
          <span className="text-xs">{allowed ? "allow" : "deny"}</span>
        </div>
      </div>

      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="grant-reason">
            Why — required, and read by whoever asks about this in a year
          </label>
          <Input
            id="grant-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contractor: read-only until the review"
          />
        </div>
        <Button size="sm" disabled={!ready || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : allowed ? "Allow" : "Deny"}
        </Button>
      </div>

      {!allowed && permission !== "" && (
        <p className="mt-2 text-xs text-muted-foreground">
          ⚠️ A deny beats every role that grants {permission}. It is the only way to take it from one
          person without editing the role that gives it to everybody else — and the only way to give it
          back is to remove this row.
        </p>
      )}
    </section>
  )
}

function DirectHoldingsTable({ overview }: { overview: AccessOverview }) {
  const queryClient = useQueryClient()

  const remove = useMutation({
    mutationFn: (holding: DirectHoldingView) =>
      revokePermission(holding.member!.id, holding.permission, holding.project?.id ?? null),
    onSuccess: () => {
      toast.success("Removed — whatever the roles say applies again")
      void queryClient.invalidateQueries({ queryKey: ["access", "overview"] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Permission</TableHead>
          <TableHead className="w-24">Effect</TableHead>
          <TableHead>Where</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="w-24" />
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
            <TableCell>
              {holding.member && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(holding)}
                >
                  Remove
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * Every project this screen knows about, from the holdings it is already showing.
 *
 * ⚠️ **Derived rather than fetched, and the limit is worth stating.** `GET /api/projects` answers with
 * the *caller's* projects, which is the wrong list here — an access administrator need not belong to
 * the project they are fixing. Every project has at least its creator holding a role in it, so the
 * holdings cover all of them in practice; a project whose every holding was somehow removed would not
 * appear, and putting somebody back into it is then a job for the project's own people screen.
 */
function knownProjects(overview: AccessOverview) {
  const byId = new Map<string, { id: string; key: string; name: string }>()

  for (const holding of [...overview.roleHoldings, ...overview.directHoldings]) {
    if (holding.project) {
      byId.set(holding.project.id, holding.project)
    }
  }

  return [...byId.values()].sort((first, second) => first.key.localeCompare(second.key))
}

/** A labelled select with an explicit empty choice, so "not chosen" is never mistaken for the first option. */
function PickerField({
  label,
  value,
  onChange,
  emptyLabel,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  emptyLabel?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel ?? "Choose…"}</option>
        {children}
      </select>
    </div>
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
