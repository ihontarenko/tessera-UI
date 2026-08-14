import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { BoardSettingsPanel } from "@/components/board/BoardSettingsPanel"
import { ReadOnlyNotice, SettingsSection } from "@/components/projects/settings/SettingsSection"
import { getBoard } from "@/api/boards"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Board configuration where every other project decision is made (ticket 06). The sheet on the board
 * still opens the same panel; this is the copy an administrator finds by looking for settings rather
 * than by remembering that one screen hides a control the others do not.
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
