import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useMatch, useNavigate } from "react-router-dom"
import { Check, FolderKanban } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { SidebarPopover } from "@/components/layout/SidebarPopover"
import { listProjects } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"
import { readLastProjectId, writeLastProjectId } from "@/lib/lastProject"

/**
 * Moving between projects in one click (ticket 09).
 *
 * Projects, Boards and Backlog used to be three sidebar entries rendering the same list of the member's
 * projects, each existing only to be clicked through. Two of them are gone; this replaces the hop the
 * third one imposed, and remembers the project it was last used on so reopening Tessera lands where the
 * work was.
 *
 * It lives in the sidebar header rather than an application header because this shell deliberately has
 * no desktop header (see `ApplicationLayout`), and it is built on `SidebarPopover` for the same reason
 * the language switcher is: a Radix-positioned panel anchors to the wrong point under the font-scale
 * zoom this sidebar supports.
 */
export function ProjectSwitcher() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const projectRoute = useMatch("/projects/:projectId")
  const [filter, setFilter] = useState("")

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  const routeProjectId = projectRoute?.params.projectId ?? null

  // Being in a project is what makes it the last one — not opening the switcher, and not a project
  // that has since been deleted or left, which is why the remembered id is only ever used to look one
  // up in the member's own list.
  useEffect(() => {
    if (routeProjectId) {
      writeLastProjectId(routeProjectId)
    }
  }, [routeProjectId])

  const currentProjectId = routeProjectId ?? readLastProjectId()
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null

  const matches = useMemo(() => {
    const needle = filter.trim().toLowerCase()

    if (needle.length === 0) {
      return projects
    }

    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(needle) || project.key.toLowerCase().includes(needle),
    )
  }, [projects, filter])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarPopover
          trigger={({ onClick, open }) => (
            <SidebarMenuButton onClick={onClick} isActive={open} tooltip={t("nav.switchProject", "Switch project")}>
              <FolderKanban className="size-4" />
              <span className="truncate">
                {currentProject?.name ?? t("nav.switchProject", "Switch project")}
              </span>
            </SidebarMenuButton>
          )}
        >
          {/* The filter earns its place well before a member has many projects: typing a key is faster
              than reading a list, and the list only grows. */}
          <div className="p-1" onClick={(event) => event.stopPropagation()}>
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t("nav.filterProjects", "Filter projects…")}
              className="h-8"
              aria-label={t("nav.filterProjects", "Filter projects…")}
            />
          </div>

          {matches.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              {t("nav.noProjects", "No projects match.")}
            </p>
          )}

          {matches.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/projects/${project.id}`)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
              <span className="truncate">{project.name}</span>
              {project.id === currentProjectId && <Check className="ml-auto size-4 shrink-0" />}
            </button>
          ))}
        </SidebarPopover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
