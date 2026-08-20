import { RankedRow, RankedTail, RANKED_ROWS } from "@/components/dashboard/RankedRow"
import { categoryColor } from "@/components/dashboard/statusPalette"
import type { AgeingIssue } from "@/api/dashboard"
import { useLanguage } from "@/context/LanguageContext"

/**
 * The open issues that have sat longest where they are.
 *
 * ⚠️ **This is the number a board cannot show.** A card looks identical on its first day in a column and
 * on its fortieth, so "what is stuck" — the question a standup actually asks — is the one question a
 * board is structurally unable to answer. This is not a prettier board; it is its missing half.
 *
 * ⚠️ **Days in the CURRENT status, not the issue's age.** An issue raised in March and moved yesterday
 * is one day old here, and correctly so: the clock is on the sit, not on the work.
 *
 * Colour is the status category, so a row is findable among its kind — and because several rows can
 * share a hue, every row also carries its status in words and its age as a number.
 */
export function AgeingList({ ageing, openTotal }: { ageing: AgeingIssue[]; openTotal: number }) {
  const { t } = useLanguage()

  const rows = ageing.slice(0, RANKED_ROWS)
  const longest = rows[0]?.days ?? 1

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("dashboard.ageing.empty", "Nothing is open.")}
      </p>
    )
  }

  return (
    <div>
      <ul className="space-y-0.5">
        {rows.map((issue) => (
          <RankedRow
            key={issue.issueKey}
            to={`/issues/${issue.issueKey}`}
            title={issue.issueKey}
            subtitle={
              <>
                {issue.summary}
                <span className="ml-1.5 text-xs text-muted-foreground">· {issue.status}</span>
              </>
            }
            value={issue.days}
            unit={t("dashboard.ageing.unit", "d")}
            share={longest > 0 ? issue.days / longest : 0}
            color={categoryColor(issue.category)}
          />
        ))}
      </ul>

      <RankedTail
        shown={rows.length}
        total={openTotal}
        label={t("dashboard.ageing.tail", "the {shown} longest-sitting of {total} open")
          .replace("{shown}", String(rows.length))
          .replace("{total}", String(openTotal))}
      />
    </div>
  )
}
