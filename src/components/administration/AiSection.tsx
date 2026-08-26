import { AlertTriangle, Ban, Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@jmouse/ui"
import { AdministrationSection } from "@/components/administration/AdministrationPieces"
import { ActivityPanel } from "@/components/administration/ai/ActivityPanel"
import { AgentsPanel } from "@/components/administration/ai/AgentsPanel"
import { CataloguePanel } from "@/components/administration/ai/CataloguePanel"
import { PromptPanel } from "@/components/administration/ai/PromptPanel"
import { ProviderPanel } from "@/components/administration/ai/ProviderPanel"
import { useAiOverview } from "@/hooks/useAiAdministration"
import type { AiOverview } from "@/api/ai"
import { cn } from "@/lib/helpers"

/**
 * The machinery behind the assistant and the protocol endpoint, on one screen.
 *
 * **The server half is `jmouse-ai-management`'s, not Tessera's** — six controllers over the library's
 * own ports, answering at `/jmouse/ai/api`. Innoventa met these and wrote its own copy instead, because a
 * library's handler cannot carry an authorization declaration and the only gate left was a URL rule
 * keyed on a *role*. `ExternalAccessRules` is what removed that reason: Tessera states the requirement
 * *about* those types in `security/access/AiManagementAccess`, and the same engine decides them as
 * every route it wrote itself. Reads ask `ai:read`, the writes ask `ai:administer`.
 *
 * **Which is why the assistant needs no property.** The provider, the model, the token ceiling and the
 * key are rows in `ai_provider_settings`, so switching the assistant on is a form somebody fills in —
 * not a file, a deploy and a secret handed to whoever does deploys.
 *
 * ⚠️ **Unlike the catalog sections beside it, reading here is gated.** Those keep their reads open
 * because every picker in the product is built from them; this one discloses what every caller has done
 * across the installation, which is its own power — so a member without `ai:read` meets a refusal
 * rather than a read-only screen.
 */
export function AiSection({
  canRead,
  canAdminister,
}: {
  canRead: boolean
  canAdminister: boolean
}) {
  const overview = useAiOverview()

  if (!canRead) {
    return (
      <AdministrationSection
        title="AI"
        description="The assistant, the tools it holds, and what they have cost."
      >
        <Alert>
          <Ban className="size-4" />
          <AlertTitle>You do not hold this one</AlertTitle>
          <AlertDescription>
            This screen discloses what every caller has asked the tools to do across the installation,
            which is its own power. Ask an administrator for <code>ai:read</code>.
          </AlertDescription>
        </Alert>
      </AdministrationSection>
    )
  }

  return (
    <AdministrationSection
      title="AI"
      description="The assistant, the tools it holds, and what they have cost. The provider is a row here, not a property — changing it takes effect on the next request."
    >
      {overview.data && <InForce overview={overview.data} />}

      <Tabs defaultValue="provider" className="space-y-4">
        <TabsList>
          <TabsTrigger value="provider">Provider</TabsTrigger>
          {/* Beside the provider rather than at the end: which model answers and what it is told are
              the two halves of one question, and somebody who has just put a provider in force is one
              tab away from the thing that decides how it behaves. */}
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="catalogue">
            Actions
            {/* Actions, not tools — eight actions may be three namespaces, and the count somebody
                reads here is of things that can be done. No margin: the trigger is a flex row that
                already spaces its children, and adding one on top of that gap reads as two words. */}
            <Badge variant="secondary">{overview.data?.publishedActions ?? "—"}</Badge>
          </TabsTrigger>
          {/* Beside the actions rather than on a screen of its own: an action is what CAN be done and
              an agent is WHO may do it, and the two are read together or not at all. */}
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="provider">
          <ProviderPanel canAdminister={canAdminister} />
        </TabsContent>

        <TabsContent value="prompt">
          <PromptPanel canAdminister={canAdminister} />
        </TabsContent>

        <TabsContent value="catalogue">
          <CataloguePanel />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsPanel />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityPanel trailRecorded={overview.data?.trailRecorded ?? true} />
        </TabsContent>
      </Tabs>
    </AdministrationSection>
  )
}

/**
 * What is actually in force, above every tab.
 *
 * ⚠️ **Not the same question as which row is ticked.** This is what the settings source returned when
 * it was asked — so it is empty when nothing is active, empty again when two rows are and the library
 * refuses to choose between them, and present-but-unusable when the configuration carries no key. Each
 * of those is a different sentence, because each has a different fix.
 */
function InForce({ overview }: { overview: AiOverview }) {
  const provider = overview.activeProvider

  if (!provider) {
    return (
      <Alert>
        <Sparkles className="size-4" />
        <AlertTitle>No provider is in force</AlertTitle>
        <AlertDescription>
          The assistant is off and says so; the tools themselves are unaffected — a connected client
          still reaches every one of them. Add a configuration below and put it in force.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            overview.assistantAvailable ? "bg-emerald-500" : "bg-amber-500",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {provider.providerName} / {provider.model}
          </div>
          <div className="text-xs text-muted-foreground">
            up to {provider.maximumTokens} tokens per answer
            {provider.apiUrl ? ` · ${provider.apiUrl}` : ""}
          </div>
        </div>
        <Badge variant={overview.assistantAvailable ? "default" : "secondary"}>
          {overview.assistantAvailable ? "Assistant answering" : "Assistant off"}
        </Badge>
      </div>

      {/* ⚠️ `usable`, not `keyConfigured`. A provider running on this machine has no credential to
          give, and warning that it has none would be alarming somebody about the thing working
          correctly — the server decides which of the two this is, because only it knows the provider. */}
      {!provider.usable && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>The configuration in force has no key</AlertTitle>
          <AlertDescription>
            Every call through it would be refused before it was sent. Edit the configuration and give
            it one.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
