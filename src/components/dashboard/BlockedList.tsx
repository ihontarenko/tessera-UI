import { RankedRow, RankedTail, RANKED_ROWS } from "@/components/dashboard/RankedRow"
import type { BlockedIssue } from "@/api/dashboard"
import { useLanguage } from "@/context/LanguageContext"

/**
 * What cannot start, and for how long.
 *
 * ⚠️ **The same definition the engine enforces.** The server assembles this from `IssueBlockers`, which
 * is the single place that decides what "blocked" means — an inward link whose type carries a blocking
 * effect and whose far end is still open, at depth one, and a warning is not a block. A dashboard
 * counting it its own way would disagree with the board about the same card.
 *
 * ⚠️ **Cannot-start, not cannot-finish.** Two different rules (`BLOCKS_START` against `BLOCKS_DONE`),
 * and only the first is what anybody means by "blocked" in ordinary use. Folding both into one list
 * would put two different problems under one label.
 *
 * ⚠️ **The blockers are keys, never summaries** — one may sit in a project this reader cannot open, and
 * a key is enough to go and ask about.
 *
 * ⚠️ **Drawn in `--destructive`, not in a category hue.** Being blocked is not a status — these issues
 * sit in whatever status they sit in — so painting them from the category palette would claim a bucket
 * the row is not about, and the three category hues stay reserved for the meter, the movement chart and
 * the ageing list where they do mean the category. It is a reserved status colour used for a genuine
 * problem state and it ships with a label ("Blocked", and "by X" on every row), never colour alone.
 *
 * ⚠️ A neutral grey was the first choice and is too faint to be a mark: `--ink-4` is 2.38:1 against the
 * light surface, well under the 3:1 floor, and these bars are 4px tall. `--destructive` clears it, and
 * the theme already guarantees that value is legible in all 27 themes.
 */
export function BlockedList({ blocked, blockedTotal }: { blocked: BlockedIssue[]; blockedTotal: number }) {
  const { t } = useLanguage()

  const rows = blocked.slice(0, RANKED_ROWS)
  const longest = rows[0]?.days ?? 1

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("dashboard.blocked.empty", "Nothing is blocked.")}
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
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                  · {t("dashboard.blocked.by", "by")} {issue.blockers.join(", ")}
                </span>
              </>
            }
            value={issue.days}
            unit={t("dashboard.blocked.unit", "d")}
            share={longest > 0 ? issue.days / longest : 0}
            color="var(--destructive)"
          />
        ))}
      </ul>

      <RankedTail
        shown={rows.length}
        total={blockedTotal}
        label={t("dashboard.blocked.tail", "the {shown} longest-held of {total} blocked")
          .replace("{shown}", String(rows.length))
          .replace("{total}", String(blockedTotal))}
      />
    </div>
  )
}
