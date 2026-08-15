import { useState } from "react"
import { Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CatalogDialog } from "@/components/administration/AdministrationPieces"
import {
  useCreateProviderConfiguration,
  useDiscardProviderConfiguration,
  useProviderConfigurations,
  usePutProviderConfigurationInForce,
  useTakeProviderConfigurationOutOfForce,
  useUpdateProviderConfiguration,
} from "@/hooks/useAiAdministration"
import type { ProviderConfiguration } from "@/api/ai"

/**
 * Which model this installation talks to, on whose key.
 *
 * **This is the screen that replaced a property.** The rows live in `ai_provider_settings` and the
 * settings source reads them per call, so rotating a key is a form rather than a deploy — and the
 * person who does it holds `ai:administer` rather than access to the server's environment.
 *
 * ⚠️ **The key is write-only, everywhere.** No response carries one, so an existing configuration shows
 * *key set* and an empty box. Leaving that box empty on a save means **keep the stored key** — the only
 * behaviour that lets somebody correct a model name without silently erasing the credential.
 */
export function ProviderPanel({ canAdminister }: { canAdminister: boolean }) {
  const configurations = useProviderConfigurations(canAdminister)
  const activate = usePutProviderConfigurationInForce()
  const deactivate = useTakeProviderConfigurationOutOfForce()
  const remove = useDiscardProviderConfiguration()

  const [editing, setEditing] = useState<ProviderConfiguration | null>(null)
  const [creating, setCreating] = useState(false)

  if (!canAdminister) {
    return (
      <Alert>
        <Info className="size-4" />
        <AlertTitle>Reading is not administering</AlertTitle>
        <AlertDescription>
          Choosing the provider decides what this installation sends somebody else&rsquo;s servers and
          holds the key it pays with, so it is its own permission. Ask an administrator for{" "}
          <code>ai:administer</code>.
        </AlertDescription>
      </Alert>
    )
  }

  const rows = configurations.data?.configurations ?? []
  const supported = configurations.data?.supportedProviders ?? []
  const busy = activate.isPending || deactivate.isPending || remove.isPending

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold tracking-[-0.01em]">
            Provider configurations
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A configuration is added idle. Putting one in force takes whatever was in force out of it —
            exactly one can be active, because the library refuses to choose between two.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          New configuration
        </Button>
      </header>

      {rows.length === 0 ? (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Nothing is configured</AlertTitle>
          <AlertDescription>
            Add a provider, give it a key, and put it in force. Until then the assistant is off and says
            so; the tools themselves are unaffected — a connected client still reaches every one of them.
          </AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="w-28">Ceiling</TableHead>
              <TableHead className="w-24">Key</TableHead>
              <TableHead className="w-28">State</TableHead>
              <TableHead className="w-64" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((configuration) => (
              <TableRow key={configuration.id}>
                <TableCell className="font-mono text-xs">{configuration.provider}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{configuration.model}</div>
                  {configuration.apiUrl && (
                    <div className="text-xs text-muted-foreground">{configuration.apiUrl}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{configuration.maximumTokens}</TableCell>
                <TableCell>
                  <Badge variant={configuration.keyConfigured ? "outline" : "destructive"}>
                    {configuration.keyConfigured ? "set" : "missing"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={configuration.active ? "default" : "secondary"}>
                    {configuration.active ? "In force" : "Idle"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setEditing(configuration)}
                    >
                      Edit
                    </Button>
                    {configuration.active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => deactivate.mutate(configuration.id)}
                      >
                        Take out of force
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy || !configuration.keyConfigured}
                        title={
                          configuration.keyConfigured
                            ? undefined
                            : "Give it a key first — every call through it would be refused before it was sent."
                        }
                        onClick={() => activate.mutate(configuration.id)}
                      >
                        Put in force
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={busy || configuration.active}
                      title={
                        configuration.active
                          ? "This is the one in force. Take it out of force first."
                          : undefined
                      }
                      onClick={() => remove.mutate(configuration.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {(creating || editing) && (
        <ProviderDialog
          configuration={editing}
          supportedProviders={supported}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </section>
  )
}

function ProviderDialog({
  configuration,
  supportedProviders,
  onClose,
}: {
  /** Null for a new one — which is created idle, because typing a key is not saying "start spending". */
  configuration: ProviderConfiguration | null
  supportedProviders: string[]
  onClose: () => void
}) {
  const create = useCreateProviderConfiguration()
  const update = useUpdateProviderConfiguration()

  const [provider, setProvider] = useState(configuration?.provider ?? supportedProviders[0] ?? "")
  const [model, setModel] = useState(configuration?.model ?? "")
  const [apiKey, setApiKey] = useState("")
  const [apiUrl, setApiUrl] = useState(configuration?.apiUrl ?? "")
  const [maximumTokens, setMaximumTokens] = useState(configuration?.maximumTokens ?? 4096)

  const pending = create.isPending || update.isPending

  function submit() {
    const payload = { provider, model, apiKey, apiUrl, maximumTokens }

    if (configuration) {
      update.mutate({ id: configuration.id, ...payload }, { onSuccess: onClose })
      return
    }

    create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <CatalogDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
      title={configuration ? "Edit configuration" : "New configuration"}
      description={
        configuration
          ? "Changing this takes effect on the next request — the settings are read per call, not at startup."
          : "Added idle. Putting it in force is a second press, and it is the press that changes what the assistant does."
      }
      submitLabel={configuration ? "Save" : "Add it"}
      canSubmit={provider.length > 0 && model.trim().length > 0 && maximumTokens > 0}
      isPending={pending}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-provider">Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger id="ai-provider">
              <SelectValue placeholder="Choose a provider" />
            </SelectTrigger>
            <SelectContent>
              {supportedProviders.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-model">Model</Label>
          <Input
            id="ai-model"
            value={model}
            placeholder="claude-sonnet-4-5"
            onChange={(event) => setModel(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-key">API key</Label>
        <Input
          id="ai-key"
          type="password"
          autoComplete="off"
          className="font-mono"
          value={apiKey}
          placeholder={
            configuration?.keyConfigured
              ? "A key is set — leave blank to keep it"
              : "Required before it can be put in force"
          }
          onChange={(event) => setApiKey(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Never shown again after it is saved. Blank means keep the stored one — it never means clear it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-endpoint">Endpoint</Label>
          <Input
            id="ai-endpoint"
            value={apiUrl}
            placeholder="The provider's own, unless you say otherwise"
            onChange={(event) => setApiUrl(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-tokens">Tokens per answer</Label>
          <Input
            id="ai-tokens"
            type="number"
            min={1}
            value={maximumTokens}
            onChange={(event) => setMaximumTokens(Number(event.target.value))}
          />
        </div>
      </div>
    </CatalogDialog>
  )
}
