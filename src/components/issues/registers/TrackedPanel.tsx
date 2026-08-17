import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link2, Network, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/EmptyState"
import { SearchInput } from "@/components/SearchInput"
import { SegmentedControl } from "@/components/SegmentedControl"
import { IssueTypeIcon } from "@/components/issues/issueVisuals"
import { LinkTargetPicker } from "@/components/issues/registers/LinkTargetPicker"
import { RegisterSection } from "@/components/issues/registers/RegisterSection"
import { REGISTERS_QUERY_KEY, useRegisterLinking } from "@/components/issues/registers/useRegisterLinking"
import { fetchIssueRegisters, fetchLinkTypes, searchIssues, type IssueSearchItem, type LinkType } from "@/api/issues"
import { EDIT_ISSUE } from "@/api/permissions"
import { listProjects } from "@/api/projects"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

const ANY_TYPE = "__any__"
const PAGE_SIZE = 10

/**
 * ⚠️ **The only place a link type is named in this product's code, and it is a <em>default</em>.**
 *
 * TSSR-43 seeds a type called `Tracks` and the tab is named after it, so opening on any other type would be
 * a screen whose title matched nothing on it. But a link type is a row on a configuration screen: rename it
 * and this simply falls through to "any type", which is a tab that still works. Nothing downstream — no
 * query, no permission, no refusal — knows this string exists (TSSR-40 is the receipt for why).
 */
const PREFERRED_LINK_TYPE_NAME = "Tracks"

/**
 * The Tracked tab: which efforts are being gathered, and the room to manage them (TSSR-45).
 *
 * ⚠️ **It answers a question the product could not answer at all.** A tracking issue was visible only from
 * itself — open the hub and you see its register; forget the hub's key and the effort is gone. This lists
 * every register the reader can browse, so an effort is findable rather than remembered.
 */
export function TrackedPanel() {
  const [linkTypeId, setLinkTypeId] = useState(ANY_TYPE)
  const [hasChosenType, setHasChosenType] = useState(false)
  const [inward, setInward] = useState(false)
  const [page, setPage] = useState(0)
  const [isStarting, setIsStarting] = useState(false)

  const { data: linkTypes = [] } = useQuery({ queryKey: ["link-types"], queryFn: fetchLinkTypes })
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  // The default is applied once the catalog arrives and never again, so a reader who deliberately chose
  // "any type" does not have their choice overwritten the next time the query refreshes.
  useEffect(() => {
    if (hasChosenType || linkTypes.length === 0) {
      return
    }

    const preferred = linkTypes.find((linkType) => linkType.name === PREFERRED_LINK_TYPE_NAME)

    setLinkTypeId(preferred ? preferred.id : ANY_TYPE)
    setHasChosenType(true)
  }, [linkTypes, hasChosenType])

  useEffect(() => {
    setPage(0)
  }, [linkTypeId, inward])

  const parameters = {
    linkTypeId: linkTypeId === ANY_TYPE ? undefined : linkTypeId,
    inward,
    page,
    size: PAGE_SIZE,
  }

  const { data: registers, isLoading } = useQuery({
    queryKey: [...REGISTERS_QUERY_KEY, parameters],
    queryFn: () => fetchIssueRegisters(parameters),
  })

  const items = registers?.items ?? []
  const total = registers?.total ?? 0
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0)

  function canEditIn(projectId: string) {
    return (projects.find((project) => project.id === projectId)?.myPermissions ?? []).includes(EDIT_ISSUE)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={linkTypeId} onValueChange={setLinkTypeId}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Link type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_TYPE}>Every kind of link</SelectItem>
            {linkTypes.map((linkType) => (
              <SelectItem key={linkType.id} value={linkType.id}>
                {linkType.outwardLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* ⚠️ One end at a time, said in the link type's own words. A list holding both ends showed an issue
            twice for one link — once as what it gathers, once as what gathers it — and neither row said which
            it was. The segments read "tracks"/"tracked by" for an asymmetric type, and fall back to
            Outward/Inward for a symmetric one, where the two labels are the same word. */}
        <SegmentedControl
          ariaLabel="Which end of the link"
          segments={directionSegments(linkTypes.find((linkType) => linkType.id === linkTypeId))}
          value={inward ? "inward" : "outward"}
          onChange={(value) => setInward(value === "inward")}
        />

        <span className="text-xs text-muted-foreground">
          {total === 1 ? "1 register" : `${total} registers`}
        </span>

        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setIsStarting((starting) => !starting)}
        >
          <Plus className="mr-1 size-3.5" /> Start a register
        </Button>
      </div>

      {isStarting && <RegisterStarter linkTypeId={linkTypeId} canEditIn={canEditIn} />}

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={Network}
          title={inward ? "Nothing is gathered by anything" : "Nothing is being tracked yet"}
          message={
            linkTypeId === ANY_TYPE
              ? "No issue sits on this end of a link yet. Start a register above to pull an effort that spans projects under one issue."
              : "No issue sits on this end of a link of this kind. Try the other end, or every kind of link."
          }
        />
      )}

      {/* The hairline between groups is the only separator — see `IssueGroup` for why they stopped being
          cards holding tables. */}
      <div className="divide-y">
        {items.map((register) => (
          <RegisterSection
            key={register.issue.id}
            register={register}
            linkTypes={linkTypes}
            inward={inward}
            canEdit={canEditIn(register.project.id)}
          />
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {items.length} of {total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The two ends of a link, named as the chosen type names them.
 *
 * ⚠️ **A symmetric type falls back to Outward/Inward.** `Relates` reads "relates to" both ways, so its own
 * labels would draw two segments with the same word on them — a control that looks broken. The direction
 * still exists in the data, so the fallback says which side is which without pretending the words differ.
 */
function directionSegments(linkType: LinkType | undefined) {
  const isAsymmetric = linkType !== undefined && linkType.outwardLabel !== linkType.inwardLabel

  return [
    { value: "outward", label: isAsymmetric ? (linkType as LinkType).outwardLabel : "Outward" },
    { value: "inward", label: isAsymmetric ? (linkType as LinkType).inwardLabel : "Inward" },
  ]
}

/**
 * Making an issue into a hub.
 *
 * ⚠️ **A register cannot be started from the list, because an issue with no links is not on it.** The list
 * is derived — "an issue that gathers something" — rather than a kind of issue somebody creates, which is
 * exactly the decision TSSR-43 took when it turned down a container entity. So the first link is made here,
 * against an issue chosen by search, and the register appears in the list the moment it exists.
 */
function RegisterStarter({
  linkTypeId,
  canEditIn,
}: {
  linkTypeId: string
  canEditIn: (projectId: string) => boolean
}) {
  const [text, setText] = useState("")
  const [hub, setHub] = useState<IssueSearchItem | null>(null)
  const debouncedText = useDebouncedValue(text, 250)
  const { linkAll } = useRegisterLinking()

  const { data: linkTypes = [] } = useQuery({ queryKey: ["link-types"], queryFn: fetchLinkTypes })
  const { data: results } = useQuery({
    queryKey: ["issue-search", "hub-candidates", debouncedText],
    queryFn: () => searchIssues({ text: debouncedText.trim() || undefined, size: 20 }),
  })

  // Any type will do to *make* a link; the filter above says which registers are being read, and the two
  // are not the same question. Falling back keeps the panel usable while "every kind" is selected.
  const newLinkTypeId = linkTypeId === ANY_TYPE ? (linkTypes[0]?.id ?? "") : linkTypeId

  if (!hub) {
    const candidates = results?.items ?? []

    return (
      <Card>
        <CardHeader className="pb-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Which issue gathers the effort?
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          <SearchInput value={text} onChange={setText} placeholder="Find the issue to gather onto…" />

          {candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Type to search every project you belong to. It has to be an issue you may edit.
            </p>
          )}

          <ul className="space-y-0.5">
            {candidates.map((row) => (
              <li key={row.issue.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
                  disabled={!canEditIn(row.project.id)}
                  title={canEditIn(row.project.id) ? undefined : "You cannot edit issues in this project"}
                  onClick={() => setHub(row)}
                >
                  <IssueTypeIcon type={row.issue.type} />
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                    {row.project.key}
                  </Badge>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{row.issue.issueKey}</span>
                  <span className="min-w-0 flex-1 truncate">{row.issue.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link2 className="size-3.5 text-muted-foreground" />
          <Badge variant="outline" className="font-mono text-[10px]">
            {hub.project.key}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{hub.issue.issueKey}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{hub.issue.summary}</span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setHub(null)}>
            Choose another
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <LinkTargetPicker
          hubIssueId={hub.issue.id}
          linkedIssueKeys={[]}
          isPending={linkAll.isPending}
          onLink={(targetIssueIds) =>
            linkAll.mutate(
              { hubIssueId: hub.issue.id, linkTypeId: newLinkTypeId, targetIssueIds },
              { onSuccess: () => setHub(null) },
            )
          }
        />
      </CardContent>
    </Card>
  )
}
