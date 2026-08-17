import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/PageHeader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IssueSearchPanel } from "@/components/issues/search/IssueSearchPanel"
import { TrackedPanel } from "@/components/issues/registers/TrackedPanel"
import { useLanguage } from "@/context/LanguageContext"

const TABS = ["all", "tracked"] as const

type IssuesTab = (typeof TABS)[number]

/**
 * The cross-project issue screen — two views of "everything I can see" (TSSR-45).
 *
 * A thin shell on purpose: both tabs are their own panel, and this file decides only which one is showing.
 * The two answer different questions — *find me an issue* and *what effort is being tracked* — and the
 * second used to have no screen at all: a tracking issue was visible only from itself (TSSR-43).
 *
 * ⚠️ **The tab is in the URL**, the way the project screen's is. A register somebody is reading is a thing
 * they will want to send to somebody else, and a link that always lands on the search is a link that lost
 * the point of being sent.
 */
export function IssuesPage() {
  const { t } = useLanguage()
  const [searchParameters, setSearchParameters] = useSearchParams()

  const activeTab = resolveTab(searchParameters.get("tab"))

  return (
    <>
      <PageHeader
        title={t("nav.allIssues", "All issues")}
        description={t("issues.search.description", "Every issue in every project you belong to.")}
      />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParameters({ tab }, { replace: true })}
        className="space-y-3"
      >
        <TabsList>
          <TabsTrigger value="all">{t("issues.tab.all", "All")}</TabsTrigger>
          <TabsTrigger value="tracked">{t("issues.tab.tracked", "Tracked")}</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <IssueSearchPanel />
        </TabsContent>

        <TabsContent value="tracked">
          <TrackedPanel />
        </TabsContent>
      </Tabs>
    </>
  )
}

/** A `tab` nobody recognises lands on the search rather than on a blank panel. */
function resolveTab(value: string | null): IssuesTab {
  return TABS.includes(value as IssuesTab) ? (value as IssuesTab) : "all"
}
