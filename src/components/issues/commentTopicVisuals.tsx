import type { CSSProperties } from "react"
import {
  Ban,
  Check,
  CircleHelp,
  ClipboardCheck,
  FileSearch,
  Gavel,
  Link2,
  LifeBuoy,
  ListChecks,
  Microscope,
  OctagonAlert,
  StickyNote,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/helpers"

/**
 * The drawing for each comment-topic icon key (TSSR-30).
 *
 * ⚠️ **This map and `CommentTopicIcons.ALL` on the server are two halves of one list**, and they have to
 * agree — the server refuses a key it does not know, and a key it allows that is missing here draws the
 * generic mark, which is an invisible typo. Adding an icon is both edits.
 *
 * ⚠️ **Deliberately not the issue-type map.** Those keys name kinds of *work* — `epic`, `bug`, `spike` —
 * and these name kinds of *remark*. Sharing one list would offer "Epic" as the drawing for a comment
 * about a root cause: not a smaller list being generous, a wrong one being reused.
 */
const TOPIC_ICONS: Record<string, LucideIcon> = {
  // The seeded six.
  "cannot-reproduce": Ban,
  "code-review": ClipboardCheck,
  "root-cause": Microscope,
  workaround: LifeBuoy,
  decision: Gavel,
  "test-evidence": ListChecks,
  // Kinds of remark a team distinguishes beyond those.
  question: CircleHelp,
  blocker: OctagonAlert,
  note: StickyNote,
  reference: Link2,
  agreement: Check,
  objection: FileSearch,
}

export function CommentTopicIcon({ iconKey, className }: { iconKey: string | null; className?: string }) {
  const Icon = (iconKey && TOPIC_ICONS[iconKey]) || StickyNote

  return <Icon className={cn("size-2.5 shrink-0", className)} aria-hidden />
}

/**
 * A topic's colour, as the two things that draw with it.
 *
 * ⚠️ **The stored colour is the accent, never plain text on a plain background.** The chip mixes it
 * toward the surface the same way a status pill does (`.status-pill-custom`), so one stored hex stays
 * legible across all 27 themes and both light and dark. The left rule on a comment is a solid 2px block
 * of colour, which needs no mixing — a border is not text.
 *
 * A topic with no colour returns nothing at all: the chip falls back to muted and the comment gets no
 * rule. **Not a grey rule** — a grey edge reads as a topic whose colour happens to be grey, where no
 * edge reads as no answer, which is the truth.
 */
export function commentTopicStyle(color: string | null | undefined): {
  chipClassName: string
  chipStyle: CSSProperties | undefined
  ruleStyle: CSSProperties | undefined
} {
  if (!color) {
    return { chipClassName: "border-border bg-muted/40 text-muted-foreground", chipStyle: undefined, ruleStyle: undefined }
  }

  return {
    chipClassName: "status-pill-custom border-transparent",
    chipStyle: { "--status-color": color } as CSSProperties,
    ruleStyle: { backgroundColor: color },
  }
}
