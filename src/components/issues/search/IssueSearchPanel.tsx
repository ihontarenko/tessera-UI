import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CircleDot, SlidersHorizontal, X } from "lucide-react"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, cn } from "@jmouse/ui"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { SearchInput } from "@/components/SearchInput"
import { PriorityBadge } from "@/components/issues/issueVisuals"
import { IssueListRow, IssueRowLayout } from "@/components/issues/rows/IssueListRow"
import { fetchCatalog, searchIssues } from "@/api/issues"
import { searchMembers } from "@/api/members"
import { listProjects } from "@/api/projects"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { QueryPanel, type AppliedQuery } from "@jmouse/query"
import { issues as issueSubject } from "@/components/issues/query/subject"
import { ISSUE_PRESETS } from "@/components/issues/query/presets"
import { IssueSortControl } from "@/components/issues/sorting/IssueSortControl"
import {
  GLOBAL_DEFAULT_SORT,
  GLOBAL_SORTS,
  findSort,
  type SortDirection,
} from "@/components/issues/sorting/issueSorting"
import { useLanguage } from "@/context/LanguageContext"

const ANY = "__any__"
const PAGE_SIZE = 25

/**
 * Every issue the member can see, filtered and paged (ticket 10).
 *
 * This is the answer to "show me everything" — the one list whose scope is the person rather than a project.
 * The backlog deliberately stays project-scoped: its ordering and its commitment actions only mean anything
 * inside one project, and a cross-project backlog would be a list nobody could act on.
 *
 * Filtering and paging happen on the server, because "everything I can see" is the one query with no natural
 * bound. A result links to the issue's own page rather than opening the modal: a row here comes from any
 * project, and the modal needs one project's permissions — the page resolves them from the issue itself.
 *
 * ⚠️ It is a panel rather than the page it used to be (TSSR-45), because the page now has a second tab. The
 * markup is unchanged; only the header moved out.
 */
export function IssueSearchPanel() {
  const { t } = useLanguage()
  const [text, setText] = useState("")
  const [projectId, setProjectId] = useState(ANY)
  const [statusId, setStatusId] = useState(ANY)
  const [assigneeMemberId, setAssigneeMemberId] = useState(ANY)
  const [page, setPage] = useState(0)

  /**
   * ⚠️ Seeded from the URL, ONE CLAUSE PER PARAMETER — `jmq:where`, `jmq:order`.
   *
   * A link may narrow this list, which is what makes a saved view somewhere else openable here. What it
   * may never do is carry a whole query document: the body of a saved view lives in the database, so a
   * URL naming its clauses is a link, while a URL containing them is a copy that stops matching the view
   * it came from the moment somebody edits it.
   *
   * ⚠️ Read once, deliberately. Re-reading on every render would fight the panel — a person narrowing
   * the query would have their edit replaced by whatever the address bar still said.
   */
  const [jmq, setJmq] = useState<AppliedQuery>(() => {
    const parameters = new URLSearchParams(window.location.search)

    return {
      filter: parameters.get("jmq:where"),
      order: parameters.get("jmq:order"),
    }
  })

  const [composing, setComposing] = useState(false)

  // ⚠️ Ordered by the SERVER, unlike the project list which orders in the browser. This one is paged in
  // the database, so sorting the twenty-five rows in hand would reorder the page rather than the list —
  // which is the kind of wrong that looks right. See `issueSorting.ts`.
  const [sortId, setSortId] = useState(GLOBAL_DEFAULT_SORT)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    findSort(GLOBAL_DEFAULT_SORT, GLOBAL_SORTS).defaultDirection,
  )

  const debouncedText = useDebouncedValue(text)

  // Narrowing changes what page 1 even contains, so staying on page 4 of the previous search would show an
  // empty table with no explanation.
  useEffect(() => {
    setPage(0)
  }, [debouncedText, projectId, statusId, assigneeMemberId, jmq])

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects })
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })

  const parameters = {
    text: debouncedText.trim() || undefined,
    projectId: projectId === ANY ? undefined : projectId,
    statusId: statusId === ANY ? undefined : statusId,
    assigneeMemberId: assigneeMemberId === ANY ? undefined : assigneeMemberId,
    // ⚠️ Sent alongside the controls, and the server ignores them when an expression is present. Two
    // narrowings silently intersecting is a result nobody can explain, so one of them has to win — and
    // it is the one somebody wrote out in full.
    "jmq:filter": jmq.filter || undefined,
    "jmq:order": jmq.order || undefined,
    // ⚠️ Sent only while no expression carries its own ordering. The server would ignore it anyway — an
    // expression takes the jMQ path whole — but sending a sort that is silently dropped would leave a
    // control on screen claiming to do something it is not doing.
    sort: jmq.order ? undefined : sortId,
    direction: jmq.order ? undefined : sortDirection,
    page,
    size: PAGE_SIZE,
  }

  const { data: results, isLoading } = useQuery({
    queryKey: ["issue-search", parameters],
    queryFn: () => searchIssues(parameters),
  })

  const items = results?.items ?? []
  const total = results?.total ?? 0
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0)

  const narrowed =
    debouncedText.trim() !== "" ||
    projectId !== ANY ||
    statusId !== ANY ||
    assigneeMemberId !== ANY ||
    Boolean(jmq.filter || jmq.order)

  function clearEverything() {
    setText("")
    setProjectId(ANY)
    setStatusId(ANY)
    setAssigneeMemberId(ANY)
    setJmq({ filter: null, order: null })
  }

  return (
    <div className="space-y-3">
      {/* ⚠️ ONE height for the whole row — the toolkit's `sm`. The three selects were `h-9`, the search
          box 34px and the button 30px: four controls that do one job, drawn at three sizes, because
          each was given a height by hand instead of the word the toolkit already has. */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={text}
          onChange={setText}
          size="sm"
          placeholder={t("issues.search.placeholder", "Search summaries and keys…")}
          className="w-full sm:w-64"
        />
        <FilterSelect
          value={projectId}
          onChange={setProjectId}
          placeholder={t("issues.search.project", "Project")}
          options={projects.map((project) => ({ id: project.id, label: `${project.key} · ${project.name}` }))}
        />
        <FilterSelect
          value={statusId}
          onChange={setStatusId}
          placeholder={t("issues.search.status", "Status")}
          options={(catalog?.statuses ?? []).map((status) => ({ id: status.id, label: status.name }))}
        />
        <FilterSelect
          value={assigneeMemberId}
          onChange={setAssigneeMemberId}
          placeholder={t("issues.search.assignee", "Assignee")}
          options={members.map((member) => ({
            id: member.id,
            label: member.displayName || member.email || member.id,
          }))}
        />

        {/*
          ⚠️ Beside the controls, not instead of them. Each select is one question the query already knew
          how to ask; the expression is for the questions it does not — a combination, an absence, a date
          window. The two are offered together because a person should not have to choose a *mode*.

          ⚠️ And it stays lit while an expression is APPLIED, not merely while the panel is open. The
          panel is closed by the person who has just finished narrowing the list, and every trace of
          their narrowing used to leave the screen with it.
        */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={composing || jmq.filter ? "default" : "outline"}
            onClick={() => setComposing((previous) => !previous)}
          >
            <SlidersHorizontal className="size-4" />
            {t("issues.search.expression", "Expression")}
          </Button>

          {jmq.filter || jmq.order ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title={t("issues.search.expression.clear", "Drop the expression")}
              onClick={() => setJmq({ filter: null, order: null })}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        {/* Nothing to clear is not a disabled button — it is no button. */}
        {narrowed ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={clearEverything}
          >
            {t("issues.search.clear", "Clear")}
          </Button>
        ) : null}

        {/* ⚠️ Gone while an expression is applied rather than disabled beside it: the expression's own
            `order by` is the ordering then, and a second control still on screen would be two answers to
            one question with no way to tell which won.

            ⚠️ And gone while the panel is OPEN, which is the case this guard used to miss. `!jmq.order`
            only covers an expression already applied; with the panel open and nothing applied yet, this
            control sat above the panel's own `Sort by` and `descending` — the same question asked twice,
            three centimetres apart, with nothing saying which one the list was obeying. The panel is
            where a whole query is composed, ordering included, so while it is open it is the only place
            the sort is stated. */}
        {!jmq.order && !composing && (
          <IssueSortControl
            className="ml-auto"
            options={GLOBAL_SORTS}
            sortId={sortId}
            direction={sortDirection}
            onChange={(nextSort, nextDirection) => {
              setSortId(nextSort)
              setSortDirection(nextDirection)
              // Reordering changes what page one holds, so staying on page four would show rows from the
              // middle of a list somebody has just re-asked for.
              setPage(0)
            }}
          />
        )}
      </div>

      {/*
        ⚠️ Below the controls rather than in a drawer: a filter somebody is composing and the rows it will
        narrow belong on one screen. A panel that covered the list would make every adjustment a guess.
      */}
      {composing && (
        <QueryPanel
          subject={issueSubject}
          query={jmq}
          presets={ISSUE_PRESETS}
          placeholder="issue.assignee == currentMember and issue.resolution is null"
          onApply={(applied) => {
            setJmq(applied)
            setPage(0)
          }}
        />
      )}

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          icon={CircleDot}
          title={t("issues.search.empty.title", "No issues found")}
          message={t("issues.search.empty.message", "Nothing matches these filters in the projects you belong to.")}
        />
      )}

      {!isLoading && items.length > 0 && (
        <>
          {/* One row shape, shared with every other list in the product (TSSR-53) — and no header, because a
              key, a badge, a sentence and a pill do not need to be labelled. */}
          <IssueRowLayout>
            {items.map(({ project, issue }) => (
              <IssueListRow
                key={issue.id}
                issueKey={issue.issueKey}
                summary={issue.summary}
                type={issue.type}
                status={issue.status}
                open={issue.open}
                projectKey={project.key}
                schedule={issue.schedule}
                trailing={
                  <>
                    <PriorityBadge priority={issue.priority} />
                    {issue.assignee ? (
                      <MemberChip member={issue.assignee} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("issues.unassigned", "Unassigned")}</span>
                    )}
                  </>
                }
              />
            ))}
          </IssueRowLayout>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t("issues.search.count", "{shown} of {total}", { shown: items.length, total })}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                {t("common.previous", "Previous")}
              </Button>
              <Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
                {t("common.next", "Next")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: Array<{ id: string; label: string }>
}) {
  // ⚠️ A select that is narrowing something is DRAWN as narrowing something. Three triggers reading
  // "any", "any" and "Done" are told apart only by the word inside them, which is the one part of a
  // control nobody rereads once they have set it — so the list looks unfiltered while it is not.
  const chosen = value !== ANY

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className={cn("w-40", chosen && "border-primary/50 bg-primary/5 text-foreground")}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{placeholder}: any</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
