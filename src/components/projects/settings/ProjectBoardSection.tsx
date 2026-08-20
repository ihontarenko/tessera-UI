import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@jmouse/ui"
import { BoardSettingsPanel } from "@/components/board/BoardSettingsPanel"
import { ReadOnlyNotice, SettingsSection } from "@/components/projects/settings/SettingsSection"
import { getBoard } from "@/api/boards"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Board configuration where every other project decision is made (ticket 06) — and now the only place
 * it is made. The board itself used to open a sheet over the same panel; that shortcut is a link here
 * now, so an administrator looking for settings and one looking at a board arrive at the same screen.
 *
 * The board is read unfiltered here — the filter belongs to looking at a board, not to configuring one
 * — which is why this query is keyed without a filter expression while the board screen's carries one.
 */
export function ProjectBoardSection({
  projectId,
  canAdminister,
}: {
  projectId: string
  canAdminister: boolean
}) {
  const { t } = useLanguage()
  const { data: board, isLoading } = useQuery({
    queryKey: ["board", projectId, null],
    queryFn: () => getBoard(projectId),
  })

  return (
    <SettingsSection
      title={t("project.settings.board.title", "Board")}
      description={t(
        "project.settings.board.description",
        "What the board shows, its columns and their status mappings, WIP bounds and the done-threshold.",
      )}
    >
      {!canAdminister && (
        <ReadOnlyNotice
          message={t(
            "project.settings.board.restricted",
            "You need the Administer project permission to change the board's configuration.",
          )}
        />
      )}

      {canAdminister && isLoading && <Skeleton className="h-64 w-full" />}

      {canAdminister && board && <BoardSettingsPanel projectId={projectId} board={board} />}
    </SettingsSection>
  )
}
