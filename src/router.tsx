import { Navigate, Route, Routes } from "react-router-dom"
import { ApplicationLayout } from "@/components/layout/ApplicationLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { AppearanceSettingsPage } from "@/pages/AppearanceSettingsPage"
import { AccountSettingsPage } from "@/pages/AccountSettingsPage"
import { AdministrationPage } from "@/pages/AdministrationPage"
import { ProjectsPage } from "@/pages/ProjectsPage"
import { ProjectDetailPage } from "@/pages/ProjectDetailPage"
import { IssuePage } from "@/pages/IssuePage"
import { IssuesPage } from "@/pages/IssuesPage"
import { FilesPage } from "@/pages/FilesPage"
import { AssistantPage } from "@/pages/AssistantPage"
import { SavedViewsPage } from "@/pages/SavedViewsPage"
import { SearchPage } from "@/pages/SearchPage"
import { readLastProjectReference } from "@/lib/lastProject"

/**
 * Where Tessera opens (ticket 09): the project this browser was last working in, if it remembers one.
 * A tracker is opened to continue something, and the dashboard is a worse answer than the place the
 * work was. A member who has never opened a project — or whose browser refuses local storage — still
 * lands on the dashboard.
 */
function HomeRedirect() {
  const lastProjectReference = readLastProjectReference()

  return <Navigate to={lastProjectReference ? `/projects/${lastProjectReference}` : "/dashboard"} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ApplicationLayout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/issues" element={<IssuesPage />} />
        {/* An issue is addressed by key, not id — the URL is the thing people paste (ticket 07). */}
        <Route path="/issues/:issueKey" element={<IssuePage />} />
        {/* Not under /projects/:projectId, because the conversation is not one project's: a tool
            resolves its own scope per call and will happily answer about a project the reader is not
            currently looking at. Putting it inside one would promise a confinement the dispatcher
            does not apply. */}
        {/* Not under a project: the tree spans every project the reader may browse, and their own
            folders are in no project at all. */}
        <Route path="/files" element={<FilesPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/saved-views" element={<SavedViewsPage />} />
        {/* ⚠️ NOT /issues with a query string. That screen is a filtered table; this one is ranked
            relevance over descriptions and comments. Two questions, two routes — see SearchPage. */}
        <Route path="/search" element={<SearchPage />} />
        {/* The boards and backlog index pages are gone (ticket 09): both listed the member's projects
            and existed only to be clicked through. An old bookmark lands on that list itself. */}
        <Route path="/boards/*" element={<Navigate to="/projects" replace />} />
        <Route path="/backlog/*" element={<Navigate to="/projects" replace />} />
        <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
        {/* ⚠️ Access is a section of Administration now, not a setting of yours. It lived here because
            it arrived through the account menu, and the account menu is what is about *you* — while a
            role is about everybody. The address survives as a redirect: it was handed out, and a
            bookmark that answers "not found" teaches nobody where the screen went. */}
        <Route path="/settings/access" element={<Navigate to="/administration?section=access" replace />} />
        {/* Yours, and open to everybody — it shows who you are and how to point a Model Context
            Protocol client at this installation. Nothing on it is privileged: the only thing to copy
            is a URL, and the client authenticates as the person reading the page. */}
        <Route path="/settings/account" element={<AccountSettingsPage />} />
        {/* ⚠️ Installation-wide, behind `configuration:administer` — a status, a workflow and a scheme
            belong to every project that uses them, so this is not under /projects/:projectId either.
            The route is deliberately open: a member without the permission reads the screens, and every
            write route refuses them on its own. */}
        <Route path="/administration" element={<AdministrationPage />} />
        {/* "soon" navigation items have no route yet — they land as their modules are built. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
