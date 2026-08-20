import { toast } from "sonner"
import { FileViewerDialog } from "@jmouse/files"
import { downloadAttachment, fetchAttachmentBytes } from "@/api/attachmentBytes"
import { TesseraMarkdown } from "@/components/markdown/TesseraMarkdown"
import type { Attachment } from "@/api/attachments"

/**
 * An issue's attachment, looked at without leaving the issue.
 *
 * <h2>⚠️ Almost nothing is left here, and that is the point (UIK-5)</h2>
 *
 * <p>Everything this file used to hold — deciding whether a thing is an image, a PDF, Markdown, text or
 * unshowable; the text ceiling; the honest refusal instead of an empty frame; the `blob:` mechanics and
 * revoking the object URL — moved to {@code @jmouse/files}. Kiwi lists files in a section, Innoventa in
 * a directory and Tessera on an issue, and all three were about to answer those questions separately.</p>
 *
 * <p>What stayed is exactly what no library could know:</p>
 *
 * <ul>
 *   <li>⚠️ <strong>how to fetch the bytes.</strong> Tessera authenticates with a bearer header, so an
 *       {@code <img src>} or an {@code <iframe src>} pointed at the route carries no credentials and
 *       answers 401 — which renders as <em>the file is missing</em>. The library never fetches.</li>
 *   <li>⚠️ <strong>what Markdown means here.</strong> The same renderer the issue description uses, so a
 *       {@code TES-42} inside an attached note resolves into a live reference rather than sitting there
 *       as text.</li>
 * </ul>
 */
export function AttachmentViewerDialog({
  attachment,
  onOpenChange,
}: {
  attachment: Attachment | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <FileViewerDialog
      file={attachment}
      bytes={() => fetchAttachmentBytes(attachment!.id)}
      renderMarkdown={(markdown) => <TesseraMarkdown markdown={markdown} />}
      onDownload={() =>
        downloadAttachment(attachment!.id, attachment!.name).catch(() =>
          toast.error("That file could not be downloaded."),
        )
      }
      onOpenChange={onOpenChange}
    />
  )
}
