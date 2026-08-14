import { CircleDot, FolderKanban, LayoutDashboard, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { ADMINISTER_CONFIGURATION } from "@/api/permissions"

export interface NavigationItem {
  title: string
  translationKey: string
  path: string
  icon: LucideIcon
  isBuilt: boolean
  description: string
  /**
   * An **installation-wide** permission this entry needs, compared against
   * `currentMember.globalPermissions`. Absent means everybody signed in sees it.
   *
   * ⚠️ Deliberately not a project permission. Those differ per project, so an entry gated on one would
   * appear and disappear as somebody switched projects — which is why the entries that vary that way
   * live inside a project rather than here.
   *
   * ⚠️ A courtesy, never the authorization: the route is open and the server refuses. Hiding a control
   * somebody cannot use is about not teasing them, and it is not a security boundary.
   */
  requiredGlobalPermission?: string
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
  {
    // A group of its own rather than a fourth entry under Work, because it is not work: everything
    // above is about issues, and this is about the catalogs issues are made of. The group disappears
    // entirely for a member without the permission — an empty heading is worse than no heading.
    title: "Configure",
    translationKey: "nav.group.configure",
    items: [
      {
        title: "Administration",
        translationKey: "nav.administration",
        path: "/administration",
        icon: SlidersHorizontal,
        isBuilt: true,
        description: "",
        requiredGlobalPermission: ADMINISTER_CONFIGURATION,
      },
    ],
  },
]

export const allNavigationItems = navigationGroups.flatMap((group) => group.items)
