import { CircleDot, FolderKanban, LayoutDashboard, type LucideIcon } from "lucide-react"

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

// Only things that exist on their own (ticket 09). Boards and Backlog used to be entries here, and
// both were the same list of the member's projects, existing only to be clicked through — a board and
// a backlog belong to a project and are reached inside it, with the switcher covering the hop they
// were there to provide. Issues — the cross-project search — was the last entry carrying a "soon"
// badge and is now built (ticket 10), so nothing here is a promise any more.
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
        title: "Issues",
        translationKey: "nav.issues",
        path: "/issues",
        icon: CircleDot,
        isBuilt: true,
        description: "",
      },
    ],
  },
]

export const allNavigationItems = navigationGroups.flatMap((group) => group.items)
