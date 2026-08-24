import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CircleDot } from "lucide-react"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@jmouse/ui"
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
  const [jmq, setJmq] = useState<AppliedQuery>({})
  const [composing, setComposing] = useState(false)

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={text}
          onChange={setText}
          placeholder={t("issues.search.placeholder", "Search summaries and keys…")}
          className="w-full sm:w-72"
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
        */}
        <Button
          type="button"
          size="sm"
          variant={composing ? "default" : "outline"}
          onClick={() => setComposing((previous) => !previous)}
        >
          {t("issues.search.expression", "Expression")}
        </Button>
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
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-44">
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
