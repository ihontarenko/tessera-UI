import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@jmouse/ui"
import { ProjectIcon } from "@/components/projects/ProjectIcon"
import { listProjects } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId"

/**
 * Moving between projects in one click (ticket 09).
 *
 * Projects, Boards and Backlog used to be three sidebar entries rendering the same list of the member's
 * projects, each existing only to be clicked through. Two of them are gone; this replaces the hop the
 * third one imposed, and remembers the project it was last used on so reopening Tessera lands where the
 * work was.
 *
 * It lives in the sidebar header rather than an application header because this shell deliberately has
 * no desktop header (see `ApplicationLayout`). It uses the ordinary `DropdownMenu` like everything else
 * — the hand-rolled `SidebarPopover` it used to need is gone, now that overlays are anchored by the
 * browser rather than by a positioning library that could not survive the font-scale zoom.
 */
export function ProjectSwitcher() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [filter, setFilter] = useState("")

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects })

  // The sidebar's Issues entry resolves the same project this switcher labels (TSSR-23), so the
  // resolution lives in one hook rather than in two components that could drift apart. A remembered id
  // is only ever used to look a project up in the member's own list, so one since deleted or left
  // simply finds nothing.
  const currentProjectId = useCurrentProjectId()
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={t("nav.switchProject", "Switch project")}>
              <ProjectIcon icon={currentProject?.icon ?? null} />
              <span className="truncate">
                {currentProject?.name ?? t("nav.switchProject", "Switch project")}
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--sidebar-width) max-w-[16rem]">
            {/* The filter earns its place well before a member has many projects: typing a key is
                faster than reading a list, and the list only grows. */}
            <div className="p-1">
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t("nav.filterProjects", "Filter projects…")}
                className="h-8"
                aria-label={t("nav.filterProjects", "Filter projects…")}
                // The panel closes on any click that lands on a menu item; typing in the filter is
                // neither, but the keyboard handler above still has to leave the field alone.
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>

            {matches.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {t("nav.noProjects", "No projects match.")}
              </p>
            )}

            {matches.map((project) => (
              <div
                key={project.id}
                data-slot="dropdown-menu-item"
                role="menuitem"
                tabIndex={-1}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {/* Fixed width so the names line up — an emoji and the fallback glyph are not the
                    same width, and a ragged left edge is what a list of icons costs otherwise. */}
                <span className="flex w-4 shrink-0 justify-center">
                  <ProjectIcon icon={project.icon} size="sm" />
                </span>
                <span className="truncate">{project.name}</span>
                {project.id === currentProjectId && <Check className="ml-auto size-4 shrink-0" />}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
