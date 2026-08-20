import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { TriangleAlert } from "lucide-react"
import { Button, Input, Label } from "@jmouse/ui"
import { ReadOnlyNotice, SettingsSection } from "@/components/projects/settings/SettingsSection"
import { rekeyProject, type ProjectResponse } from "@/api/projects"
import { apiErrorMessage } from "@/api/errors"
import { useLanguage } from "@/context/LanguageContext"

/** The same rule the backend validates, so a bad key is refused before a round trip. */
const PROJECT_KEY = /^[A-Z][A-Z0-9]*$/

/**
 * The section for the things that cannot be undone by pressing the button again.
 *
 * It holds one control today — changing the project's key — and the reason it is a section rather than
 * a field on General is that reason: everything on General changes what the installation does next,
 * while this changes what a link somebody wrote last year points at.
 *
 * ⚠️ **The warning is the feature.** A rekey rewrites what is in Tessera's database and reaches nothing
 * else: a bookmark, a Kiwi page, an Innoventa page, a commit message, a `.tessera/` mirror, an MCP client
 * that remembers the key — all of them keep pointing at a key that no longer resolves. That is a
 * decision somebody is entitled to make, and it is not one they should discover afterwards, so the list
 * is spelled out rather than summarised as "this cannot be undone".
 */
export function ProjectDangerSection({
  project,
  canAdminister,
}: {
  project: ProjectResponse
  canAdminister: boolean
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [key, setKey] = useState("")
  const [confirmation, setConfirmation] = useState("")

  const mutation = useMutation({
    mutationFn: () => rekeyProject(project.id, { key: key.trim(), confirmation: confirmation.trim() }),
    onSuccess: (result) => {
      queryClient.setQueryData(["project", project.id], result.project)
      // ⚠️ Every cached issue is now filed under a key that no longer exists, and a board card carries
      // its key as text. Nothing narrower than clearing the lot would leave the screen honest.
      void queryClient.invalidateQueries()
      setKey("")
      setConfirmation("")
      toast.success(
        t("project.settings.danger.rekey.done", "Project key changed")
          + ` — ${result.previousKey} → ${result.project.key}, `
          + t("project.settings.danger.rekey.doneIssues", "issues rewritten:")
          + ` ${result.rewrittenIssues}`,
      )
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not change the project key")),
  })

  const trimmedKey = key.trim().toUpperCase()
  const canSubmit =
    PROJECT_KEY.test(trimmedKey) &&
    trimmedKey !== project.key &&
    confirmation.trim() === project.key &&
    !mutation.isPending

  return (
    <SettingsSection
      title={t("project.settings.danger.title", "Danger zone")}
      description={t(
        "project.settings.danger.description",
        "Changes that reach outside this project, and that pressing the button again does not undo.",
      )}
    >
      {!canAdminister && (
        <ReadOnlyNotice
          message={t(
            "project.settings.danger.restricted",
            "You need the Administer project permission to change the project key.",
          )}
        />
      )}

      {canAdminister && (
        <div className="max-w-xl space-y-4 rounded-lg border border-destructive/40 p-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <TriangleAlert className="size-4" />
              {t("project.settings.danger.rekey.title", "Change the project key")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                "project.settings.danger.rekey.description",
                "Every issue keeps its number and changes its prefix — {old}-42 becomes {new}-42. The project's history, its links and its sprints are untouched.",
              )
                .replace("{old}", project.key)
                .replace("{new}", trimmedKey || "NEW")}
            </p>
          </div>

          {/* ⚠️ Named one by one rather than as "old links will break". The point of a danger zone is
              that somebody reads what they are about to do, and a list they can check against their
              own installation is the only version of this warning that can be checked. */}
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">
              {t(
                "project.settings.danger.rekey.breaks.title",
                "Everything still holding the old key stops resolving:",
              )}
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              <li>{t("project.settings.danger.rekey.breaks.links", "Bookmarks and pasted links to an issue")}</li>
              {/* ⚠️ Named separately from links because it fails differently: a live block resolves its
                  project by key and renders as "no such project" rather than as a dead link, which
                  reads like a permission problem on somebody else's page. */}
              <li>{t("project.settings.danger.rekey.breaks.wiki", "Live blocks on wiki pages — they name this project by its key")}</li>
              <li>{t("project.settings.danger.rekey.breaks.filters", "Saved filters whose expression writes the key out")}</li>
              <li>{t("project.settings.danger.rekey.breaks.outside", "Commit messages, chats and anything outside Tessera")}</li>
              <li>{t("project.settings.danger.rekey.breaks.clients", "Protocol clients that remember the old key")}</li>
            </ul>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()

              if (canSubmit) {
                mutation.mutate()
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="project-new-key">
                {t("project.settings.danger.rekey.newKey", "New key")}
              </Label>
              <Input
                id="project-new-key"
                value={key}
                onChange={(event) => setKey(event.target.value.toUpperCase())}
                placeholder={project.key}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "project.settings.danger.rekey.keyRule",
                  "Uppercase letters and digits, starting with a letter.",
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-key-confirmation">
                {t("project.settings.danger.rekey.confirm", "Type the current key to confirm")}
              </Label>
              <Input
                id="project-key-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={project.key}
                autoComplete="off"
              />
            </div>

            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              {mutation.isPending
                ? t("project.settings.danger.rekey.working", "Changing…")
                : t("project.settings.danger.rekey.submit", "Change the key")}
            </Button>
          </form>
        </div>
      )}
    </SettingsSection>
  )
}
