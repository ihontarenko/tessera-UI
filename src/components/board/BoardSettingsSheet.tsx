import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BoardSettingsPanel } from "@/components/board/BoardSettingsPanel"
import type { BoardResponse } from "@/api/boards"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Board configuration reached from the board itself — a shortcut, kept because the person reshaping a
 * board is usually looking at it (ticket 06). Settings › Board is the same panel on its own page; this
 * is only the surface around it, so neither copy can grow a control the other lacks.
 */
export function BoardSettingsSheet({
  projectId,
  board,
  open,
  onOpenChange,
}: {
  projectId: string
  board: BoardResponse
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLanguage()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Wider than the default sheet: a column is a row now, and a row of name, contents and bounds
          needs the width or it wraps back into the stack this replaced. */}
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t("board.settings.title", "Board settings")}</SheetTitle>
          <SheetDescription>
            {t(
              "board.settings.description",
              "What this board shows, and its columns, status mappings and WIP limits.",
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {open && <BoardSettingsPanel projectId={projectId} board={board} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
