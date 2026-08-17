import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MemberChip } from "@/components/MemberChip"
import { ProjectIcon } from "@/components/projects/ProjectIcon"
import { ProjectIconPicker } from "@/components/projects/ProjectIconPicker"
import { ProjectStyleBadge } from "@/components/projects/ProjectStyleBadge"
import { DetailRow, SettingsSection } from "@/components/projects/settings/SettingsSection"
import { IssueKeyFormatEditor } from "@/components/projects/settings/IssueKeyFormatEditor"
import { WiqRootPicker } from "@/components/projects/WiqRootPicker"
import { useProjectUpdate } from "@/components/projects/settings/useProjectUpdate"
import { searchMembers } from "@/api/members"
import type { ProjectResponse } from "@/api/projects"
import { useLanguage } from "@/context/LanguageContext"
import { memberName } from "@/lib/memberDisplay"
import { PROJECT_TAB_LABELS, defaultProjectTab } from "@/lib/projectStyle"
import { resolveText } from "@/lib/translatableText"

/**
 * What a project *is*: its name, its key, who leads it, and the facts the Overview tab used to show on
 * a page of its own (ticket 06). A member without `ADMINISTER_PROJECT` still reads all of it — the
 * facts were never privileged — and simply gets no editors.
 */
export function ProjectGeneralSection({
  project,
  canAdminister,
}: {
  project: ProjectResponse
  canAdminister: boolean
}) {
  const { t } = useLanguage()
  const [name, setName] = useState(project.name)
  const [icon, setIcon] = useState(project.icon ?? "")
  const [leadMemberId, setLeadMemberId] = useState(project.lead?.id ?? "")

  const { data: members = [] } = useQuery({ queryKey: ["members", "all"], queryFn: () => searchMembers() })
  const mutation = useProjectUpdate(project, t("project.settings.general.saved", "Project updated"))

  const trimmedName = name.trim()
  const trimmedIcon = icon.trim()
  const unchanged =
    trimmedName === project.name &&
    trimmedIcon === (project.icon ?? "") &&
    leadMemberId === (project.lead?.id ?? "")
  const canSubmit = trimmedName.length > 0 && leadMemberId.length > 0 && !unchanged

  return (
    <SettingsSection
      title={t("project.settings.general.title", "General")}
      description={t("project.settings.general.description", "The project's name, its lead, and the facts that describe it.")}
    >
      {canAdminister && (
        <>
          <form
            className="max-w-xl space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSubmit) {
                // ⚠️ Empty travels as empty, not as undefined — clearing the icon is a save, and an
                // omitted field would leave the old one in place with the form showing it gone.
                mutation.mutate({ name: trimmedName, icon: trimmedIcon, leadMemberId })
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">{t("project.settings.general.name", "Name")}</Label>
              <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={128} />
            </div>

            <ProjectIconPicker icon={icon} onChange={setIcon} inputId="settings-icon" />

            <div className="space-y-1.5">
              <Label htmlFor="settings-lead">{t("project.settings.general.lead", "Lead")}</Label>
              <Select value={leadMemberId} onValueChange={setLeadMemberId}>
                <SelectTrigger id="settings-lead">
                  <SelectValue placeholder={t("project.settings.general.selectLead", "Select a lead")} />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {memberName(member)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? t("common.saving", "Saving…") : t("common.saveChanges", "Save changes")}
            </Button>
          </form>

          <Separator />

          {/* The shape of the next key, and only the next one — see IssueKeyFormatEditor. */}
          <IssueKeyFormatEditor project={project} canAdminister={canAdminister} />

          <Separator />

          {/* Which WiQ section this project's wiki lives in (WIQ-10; WIQ-1 §3).
              ⚠️ The pages are stored in another product, and who may read them is decided there —
              choosing a root here grants nobody anything. See WiqRootPicker, which also handles WiQ
              being unreachable, since that is a normal state rather than an error. */}
          <div className="space-y-1.5">
            <Label>{t("project.settings.general.wikiRoot", "Wiki section (WiQ)")}</Label>
            <WiqRootPicker
              value={project.wiqRootCategoryId}
              onChange={(wiqRootCategoryId) => mutation.mutate({ wiqRootCategoryId })}
            />
          </div>

          <Separator />
        </>
      )}

      <div className="max-w-xl">
        <DetailRow label={t("project.settings.general.key", "Key")}>
          <span className="font-mono">{project.key}</span>
        </DetailRow>
        <DetailRow label={t("project.settings.general.name", "Name")}>{project.name}</DetailRow>
        <DetailRow label={t("project.settings.general.icon", "Icon")}>
          <ProjectIcon icon={project.icon} size="lg" />
        </DetailRow>
        <DetailRow label={t("project.settings.general.leadLabel", "Lead")}>
          <MemberChip member={project.lead} />
        </DetailRow>
        <DetailRow label={t("project.settings.general.planning", "Planning")}>
          <ProjectStyleBadge boardScopeStrategy={project.boardScopeStrategy} />
        </DetailRow>
        {/* Derived, not stored: the opening view follows from how the project plans, so it is reported
            here rather than offered as a second thing to set and keep in agreement (ADR-0015). */}
        <DetailRow label={t("project.settings.general.defaultView", "Opens on")}>
          {resolveText(t, PROJECT_TAB_LABELS[defaultProjectTab(project.boardScopeStrategy)])}
        </DetailRow>
        <DetailRow label={t("project.settings.general.issueTypeScheme", "Issue type scheme")}>
          {project.issueTypeScheme?.name ?? "—"}
        </DetailRow>
        <DetailRow label={t("project.settings.general.workflowScheme", "Workflow scheme")}>
          {project.workflowScheme?.name ?? "—"}
        </DetailRow>
        <DetailRow label={t("project.settings.general.keyStrategy", "Key strategy")}>
          <span className="font-mono text-xs">{project.keyStrategy}</span>
        </DetailRow>
        {/* ⚠️ Two empty states, not one, and they are different situations (WIQ-1 §3): an
            administrator sees the picker above and is being asked to do something; everybody else sees
            this, which says the wiki is not configured rather than that it is empty. */}
        <DetailRow label={t("project.settings.general.wikiRoot", "Wiki section (WiQ)")}>
          {project.wiqRootCategoryId ? (
            <span className="font-mono text-xs">{project.wiqRootCategoryId}</span>
          ) : (
            <span className="text-muted-foreground">
              {t("project.settings.general.wikiNotConfigured", "The wiki is not configured.")}
            </span>
          )}
        </DetailRow>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("project.settings.general.keyFixed", "The key is fixed once a project exists.")}
      </p>
    </SettingsSection>
  )
}
