import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { SavedQueryManager, type ManagedSubject } from "@jmouse/query"
import { PageHeader } from "@/components/PageHeader"
import { issues as issueSubject } from "@/components/issues/query/subject"

/**
 * Saved views — every kept question, beside the declaration it is written against.
 *
 * <h2>⚠️ The screen is the library's; only the list of subjects is Tessera's</h2>
 *
 * <p>The store is one table shared by every product, the endpoints are the library's, and the language
 * is the same language everywhere. What this file supplies is the one part that genuinely belongs here:
 * which things can be queried and what a person calls them.</p>
 *
 * <h2>⚠️ Tessera has exactly one subject today, and the screen still earns its place</h2>
 *
 * <p>Its value is not the list on the left — it is that a view can be read, rewritten and deleted
 * somewhere other than the panel that happens to be filtering right now, and that the shape those views
 * are written against is visible at all. Tessera's issue source is built in Java like every other, so
 * until this screen existed there was nowhere to read it.</p>
 */
export function SavedViewsPage() {
  const navigate = useNavigate()

  const subjects = useMemo<ManagedSubject[]>(
    () => [
      {
        subject: issueSubject,
        title: "Issues",
        description:
          "Everything an issue query may name — the issue's own fields, its project, and whoever it " +
          "is assigned to.",
      },
    ],
    [],
  )

  // ⚠️ A fragment, like every other page here. The shell's content box is already
  // `flex min-h-0 flex-1 flex-col gap-4 … p-4`, so a page that wraps itself in a padded column pays
  // for that padding twice — 40px of inset on a screen where every neighbour has 16px.
  return (
    <>
      <PageHeader
        title="Saved views"
        description="The questions kept against each listing, and the shape they are asked of."
      />

      <SavedQueryManager
        subjects={subjects}
        onOpen={(_subject, query) => {
          // ⚠️ One clause per parameter, which is what makes a link openable and a view un-inlined: the
          // body stays in the database and the URL names the view's clauses rather than carrying them.
          const parameters = new URLSearchParams()

          if (query.filter) {
            parameters.set("jmq:where", query.filter)
          }

          if (query.order) {
            parameters.set("jmq:order", query.order)
          }

          navigate(`/issues?${parameters.toString()}`)
        }}
      />
    </>
  )
}
