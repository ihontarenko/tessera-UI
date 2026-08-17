import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { CircleDot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/EmptyState"
import { MemberChip } from "@/components/MemberChip"
import { SearchInput } from "@/components/SearchInput"
import { IssueTypeIcon, PriorityBadge, StatusPill } from "@/components/issues/issueVisuals"
import { fetchCatalog, searchIssues } from "@/api/issues"
import { searchMembers } from "@/api/members"
import { listProjects } from "@/api/projects"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
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

  const debouncedText = useDebouncedValue(text)

  // Narrowing changes what page 1 even contains, so staying on page 4 of the previous search would show an
  // empty table with no explanation.
  useEffect(() => {
    setPage(0)
  }, [debouncedText, projectId, statusId, assigneeMemberId])

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects })
  const { data: catalog } = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog })
  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })

  const parameters = {
    text: debouncedText.trim() || undefined,
    projectId: projectId === ANY ? undefined : projectId,
    statusId: statusId === ANY ? undefined : statusId,
    assigneeMemberId: assigneeMemberId === ANY ? undefined : assigneeMemberId,
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
      </div>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-24">{t("issues.column.key", "Key")}</TableHead>
                <TableHead className="w-32">{t("issues.column.project", "Project")}</TableHead>
                <TableHead>{t("issues.column.summary", "Summary")}</TableHead>
                <TableHead className="w-28">{t("issues.column.priority", "Priority")}</TableHead>
                <TableHead className="w-32">{t("issues.column.status", "Status")}</TableHead>
                <TableHead className="w-44">{t("issues.column.assignee", "Assignee")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(({ project, issue }) => (
                <TableRow key={issue.id}>
                  <TableCell>
                    <IssueTypeIcon type={issue.type} />
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/issues/${issue.issueKey}`}
                      className="font-mono text-xs text-muted-foreground hover:underline"
                    >
                      {issue.issueKey}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link to={`/projects/${project.id}`}>
                      <Badge variant="outline">{project.key}</Badge>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/issues/${issue.issueKey}`}
                      className={
                        issue.open ? "hover:underline" : "text-muted-foreground line-through hover:underline"
                      }
                    >
                      {issue.summary}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={issue.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={issue.status} />
                  </TableCell>
                  <TableCell>
                    {issue.assignee ? (
                      <MemberChip member={issue.assignee} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("issues.unassigned", "Unassigned")}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
