import { Navigate, Route, Routes } from "react-router-dom"
import { ApplicationLayout } from "@/components/layout/ApplicationLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { AppearanceSettingsPage } from "@/pages/AppearanceSettingsPage"
import { ProjectsPage } from "@/pages/ProjectsPage"
import { ProjectDetailPage } from "@/pages/ProjectDetailPage"
import { BoardsPage } from "@/pages/BoardsPage"

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ApplicationLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
        {/* "soon" navigation items have no route yet — they land as their modules are built. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
