import { CircleDot, Columns3, FolderKanban, LayoutDashboard, ListTodo, type LucideIcon } from "lucide-react"

export interface NavigationItem {
  title: string
  translationKey: string
  path: string
  icon: LucideIcon
  isBuilt: boolean
  description: string
}

export interface NavigationGroup {
  title: string
  translationKey: string
  items: NavigationItem[]
}

// Phase 0 shipped the shell with only the Dashboard actually built; anything still unbuilt carries a
// "soon" badge so the sidebar reads as a real tracker from day one (dense, not empty — Ivan's ask)
// while staying honest about what exists. Projects, Issues-in-project, Boards and now Backlog have
// landed; Issues (the cross-project search) is what remains.
export const navigationGroups: NavigationGroup[] = [
  {
    title: "Work",
    translationKey: "nav.group.work",
    items: [
      {
        title: "Dashboard",
        translationKey: "nav.dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        isBuilt: true,
        description: "",
      },
      {
        title: "Projects",
        translationKey: "nav.projects",
        path: "/projects",
        icon: FolderKanban,
        isBuilt: true,
        description: "",
      },
      {
        title: "Boards",
        translationKey: "nav.boards",
        path: "/boards",
        icon: Columns3,
        isBuilt: true,
        description: "",
      },
      {
        title: "Backlog",
        translationKey: "nav.backlog",
        path: "/backlog",
        icon: ListTodo,
        isBuilt: true,
        description: "",
      },
      {
        title: "Issues",
        translationKey: "nav.issues",
        path: "/issues",
        icon: CircleDot,
        isBuilt: false,
        description: "",
      },
    ],
  },
]

export const allNavigationItems = navigationGroups.flatMap((group) => group.items)
