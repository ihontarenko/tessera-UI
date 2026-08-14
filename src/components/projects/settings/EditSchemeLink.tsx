import { Link } from "react-router-dom"
import { ExternalLink } from "lucide-react"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { ADMINISTER_CONFIGURATION } from "@/api/permissions"

/**
 * The way out of a project's settings and into the scheme it is looking at.
 *
 * ⚠️ **Shown only to somebody who can act on it.** Composing a scheme is installation-wide and costs
 * `configuration:administer`, which a project administrator does not have by virtue of administering a
 * project — offering the link to everybody would send most people to a screen they can only read.
 *
 * ⚠️ **And it is a link, not an editor.** A scheme belongs to the installation and is shared by every
 * project on it; editing it from inside one project would put a global change behind a local-looking
 * control, which is exactly the confusion the Administration screen exists to avoid.
 */
export function EditSchemeLink() {
  const { data: currentMember } = useCurrentMember()

  if (!(currentMember?.globalPermissions ?? []).includes(ADMINISTER_CONFIGURATION)) {
    return null
  }

  return (
    <Link
      to="/administration?section=schemes"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Edit this scheme
      <ExternalLink className="size-3" />
    </Link>
  )
}
