import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Ban } from "lucide-react"
import { Alert, AlertDescription, AlertTitle, Badge } from "@jmouse/ui"
import { SearchInput } from "@/components/SearchInput"
import { SegmentedControl } from "@/components/SegmentedControl"
import { MemberChip } from "@/components/MemberChip"
import { AdministrationSection } from "@/components/administration/AdministrationPieces"
import { MemberEditDialog } from "@/components/administration/MemberEditDialog"
import { fetchAdministeredMembers } from "@/api/members"
import { isAgent, type MemberKind, type MemberSummary } from "@/api/members"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useLanguage } from "@/context/LanguageContext"

/**
 * Which rows the list is showing (TSSR-79).
 *
 * ⚠️ **`Clients`, not `Slaves`.** The words were proposed and describe a hierarchy the model does not
 * have: `AgentCallers` reads `RESTRICTED` as *be yourself* and does not consult the owner's permission
 * set at all, so a restricted client is not a narrowed owner — and a person owning no client is not
 * above anybody. `client` is also already what this product prints on a comment by-line.
 */
const SEGMENTS: Array<{ value: string; label: string; kind?: MemberKind }> = [
  { value: "all", label: "All" },
  { value: "people", label: "People", kind: "PERSON" },
  { value: "clients", label: "Clients", kind: "AGENT" },
]

/**
 * Everybody in the installation — the people and the clients — as one list.
 *
 * <h2>⚠️ Installation-wide, and not the project membership screen</h2>
 *
 * Project membership answers *who is on this project*. A client belongs to **its owner**, not to a
 * project, so putting it there would mean it appeared in every project or in none, and neither is true.
 * This is the other question and it gets its own screen.
 *
 * <h2>⚠️ It reads its own route, not the member directory</h2>
 *
 * `GET /api/members` is people-only on purpose (TSSR-33) and is the picker somebody adds a colleague to
 * a project from — it stays open to every signed-in caller and stays people-only. This screen asks
 * `GET /api/members/administered`, behind `member:administer`, which exists because
 * `configuration:administer`'s own note says accounts must not inherit it.
 */
export function MembersSection({ canAdminister }: { canAdminister: boolean }) {
  const { t } = useLanguage()
  const [segment, setSegment] = useState("all")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<MemberSummary | null>(null)

  const debouncedSearch = useDebouncedValue(search, 250)
  const kind = SEGMENTS.find((entry) => entry.value === segment)?.kind

  const { data: members = [] } = useQuery({
    // ⚠️ The segment is part of the key, so the three views cache separately and switching between them
    // never shows the previous one's rows under the new one's heading.
    queryKey: ["members", "administered", kind ?? "ALL", debouncedSearch],
    queryFn: () => fetchAdministeredMembers(debouncedSearch || undefined, kind),
    enabled: canAdminister,
  })

  if (!canAdminister) {
    return (
      <AdministrationSection
        title={t("administration.members.title", "Members")}
        description={t(
          "administration.members.description",
          "The people and the clients of this installation.",
        )}
      >
        <Alert>
          <Ban className="size-4" />
          <AlertTitle>{t("administration.members.refused.title", "You do not hold this one")}</AlertTitle>
          <AlertDescription>
            {t(
              "administration.members.refused.body",
              "This screen administers everybody's account, which is its own power. Ask for member:administer.",
            )}
          </AlertDescription>
        </Alert>
      </AdministrationSection>
    )
  }

  return (
    <AdministrationSection
      title={t("administration.members.title", "Members")}
      description={t(
        "administration.members.description",
        "The people and the clients of this installation. A client is a member row like any other — it has a name and a face, and what it may do is decided on the AI screen.",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel={t("administration.members.segments", "Which members to show")}
          segments={SEGMENTS.map((entry) => ({ value: entry.value, label: entry.label }))}
          value={segment}
          onChange={setSegment}
        />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("administration.members.search", "Name or email…")}
          className="w-64"
        />

        {/* ⚠️ The count follows the segment, because it is the segment's count. A header saying one
            number over a list showing another is the small kind of lie worth more than it costs. */}
        <span className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody here answers to that.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {members.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                onClick={() => setEditing(member)}
              >
                <MemberChip
                  member={member}
                  subtitle={isAgent(member) ? ownerLine(member, members) : member.email}
                />

                <span className="ml-auto flex shrink-0 items-center gap-2">
                  {isAgent(member) && (
                    <Badge variant={member.retired ? "outline" : "secondary"}>
                      {member.retired ? "client, retired" : "client"}
                    </Badge>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <MemberEditDialog
        member={editing}
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null)
          }
        }}
      />
    </AdministrationSection>
  )
}

/**
 * Whose client this is, read off the list rather than fetched.
 *
 * ⚠️ The owner is only nameable when they are in the same answer — on the `Clients` segment they are
 * not, because that segment holds no people. Saying **"a client"** then is honest; inventing a name, or
 * firing a request per row to find one, is not.
 */
function ownerLine(client: MemberSummary, members: MemberSummary[]): string {
  const owner = members.find((entry) => entry.id === client.parentId)

  if (!owner) {
    return "a client"
  }

  return `${owner.displayName ?? owner.email ?? "somebody"}'s client`
}
