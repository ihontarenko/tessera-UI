import {
  Bookmark,
  CircleDot,
  CircleDotDashed,
  FolderKanban,
  FolderOpen,
  LayoutDashboard,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { ADMINISTER_ACCESS, ADMINISTER_CONFIGURATION } from "@/api/permissions"

/** Where the member is, for the entries whose destination depends on it. */
export interface NavigationContext {
  /** ⚠️ Null before this browser has ever been in a project — an ordinary answer, not an error. */
  currentProjectId: string | null
}

/** The part of the location an entry may match on. `search` carries the leading `?`. */
export interface NavigationLocation {
  pathname: string
  search: string
}

export interface NavigationItem {
  title: string
  translationKey: string
  /**
   * Where the entry goes, and what a plain prefix match compares against.
   *
   * ⚠️ For an entry with a {@link NavigationItem.resolvePath}, this is the destination when the context
   * cannot answer — never a URL that would be wrong, always the honest fallback.
   */
  path: string
  /**
   * The destination when it depends on where the member is (TSSR-23).
   *
   * Kept as a function on the item so the navigation stays *data* the sidebar renders, rather than a
   * list with one entry the sidebar knows about by name.
   */
  resolvePath?: (context: NavigationContext) => string
  /**
   * When this location counts as being on this entry, for the entries a prefix cannot describe.
   *
   * ⚠️ An entry that defines one is matched **only** by it, and it outranks every prefix match — which
   * is what keeps two rows from lighting up at once on a URL they both describe.
   */
  matches?: (location: NavigationLocation) => boolean
  icon: LucideIcon
  isBuilt: boolean
  description: string
  /**
   * The **installation-wide** permissions this entry needs, compared against
   * `currentMember.globalPermissions`. Absent means everybody signed in sees it.
   *
   * ⚠️ **Any one of them is enough, not all of them.** A screen with several sections is worth opening
   * for whoever holds any of them — Administration carries the catalogs, Access, Members and the
   * assistant, each behind its own permission, and each section decides for itself whether it is
   * offered. Listing every permission the screen can serve is what keeps an access administrator who
   * configures nothing else from losing the only screen they came for.
   *
   * ⚠️ Deliberately not project permissions. Those differ per project, so an entry gated on one would
   * appear and disappear as somebody switched projects — which is why the entries that vary that way
   * live inside a project rather than here.
   *
   * ⚠️ A courtesy, never the authorization: the route is open and the server refuses. Hiding a control
   * somebody cannot use is about not teasing them, and it is not a security boundary.
   */
  requiredGlobalPermissions?: readonly string[]
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
//
// ⚠️ ONE ENTRY IS PROJECT-SCOPED, AND THAT IS DELIBERATE (TSSR-23). Everything above is why Boards and
// Backlog left, and **Issues** now points back into a project all the same — because reaching the
// issues of the project you are working in was two hops through a screen that shows every project's,
// which is the confusion the entries were removed to avoid rather than an instance of it. The rule the
// removal was really about still holds and is the one written on `requiredGlobalPermissions` below: an
// entry may not appear and disappear as somebody switches projects. This one is always there; only
// where it lands moves. `All issues` keeps the cross-project page, unchanged.
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
      // Where the member works: the issues of the project they are in. The fallback is the project
      // list rather than the cross-project page — this entry promises one project's issues, and
      // quietly showing every project's instead is exactly what the split was for. "Pick one first"
      // is the true answer when nothing is remembered.
      {
        title: "Issues",
        translationKey: "nav.issues",
        path: "/projects",
        resolvePath: (context) =>
          context.currentProjectId ? `/projects/${context.currentProjectId}?tab=issues` : "/projects",
        // Only the issues tab, never the whole project — without this the entry would light up on the
        // board, the backlog and the settings too, taking the highlight off Projects on all three.
        // The tab has to be named: `/projects/x` with no `?tab=` opens whichever tab the project's
        // board strategy defaults to, and the sidebar has no business knowing that. `resolvePath`
        // always writes the parameter, so the entry's own destination always matches.
        matches: (location) =>
          /^\/projects\/[^/]+$/.test(location.pathname)
          && new URLSearchParams(location.search).get("tab") === "issues",
        icon: CircleDot,
        isBuilt: true,
        description: "",
      },
      // Where the member looks something up: every issue in every project they belong to. Same subject,
      // different question — this one is a server-side search with paging and no way to create
      // anything, where the entry above is a list you work in.
      {
        title: "All issues",
        translationKey: "nav.allIssues",
        path: "/issues",
        icon: CircleDotDashed,
        isBuilt: true,
        description: "",
      },
      // Everything kept, across every project the member may browse, plus their own folders
      // (TSSR-0102). Under Work because a screenshot on a ticket is the work, not a setting.
      //
      // ⚠️ NO `requiredGlobalPermissions`, deliberately, and it is the same argument the comment on that
      // field makes. `file:read` is held AT A PROJECT for the shared tree and at `@SELF` for a personal
      // one, and never installation-wide for an ordinary member — so gating this entry on the global set
      // would hide it from everybody except administrators, which is the opposite of who it is for.
      {
        title: "Files",
        translationKey: "nav.files",
        path: "/files",
        icon: FolderOpen,
        isBuilt: true,
        description: "",
      },
      // Beside "All issues" because it is that list's memory: the questions kept against it, plus the
      // shape they are asked of.
      //
      // ⚠️ NO `requiredGlobalPermissions`, for the same reason Files carries none. A saved view is owned
      // by the member who kept it, so everybody has these and nobody needs a permission to manage their
      // own — while the ready-made ones are the installation's and are read-only to whoever may not edit
      // them, which the server decides rather than this entry.
      {
        title: "Saved views",
        translationKey: "nav.savedViews",
        path: "/saved-views",
        icon: Bookmark,
        isBuilt: true,
        description: "",
      },
      // Under Work rather than in a group of its own: it is a way of doing the same work, not a
      // different subject. No permission — the assistant reaches exactly what the member already
      // reaches, so a member with no projects gets one that can do nothing rather than a closed door.
      {
        title: "Assistant",
        translationKey: "nav.assistant",
        path: "/assistant",
        icon: Sparkles,
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
        // ⚠️ Two permissions, and either one opens it. Access moved onto this screen out of the
        // account menu, and it answers to `access:administer` — somebody who holds that and nothing
        // else would otherwise have watched the only screen they administer disappear.
        requiredGlobalPermissions: [ADMINISTER_CONFIGURATION, ADMINISTER_ACCESS],
      },
    ],
  },
]

export const allNavigationItems = navigationGroups.flatMap((group) => group.items)
