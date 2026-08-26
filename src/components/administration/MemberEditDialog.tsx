import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  AVATAR_CROP,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ImageCropper,
  Input,
  Label,
  type ImageCropperHandle,
} from "@jmouse/ui"
import { MemberAvatar } from "@/components/MemberAvatar"
import { AvatarPicker } from "@jmouse/avatars/picker"
import { chooseAvatarPresetFor, renameMember, uploadAvatarPictureFor } from "@/api/members"
import { isAgent, type MemberSummary } from "@/api/members"
import { apiErrorMessage } from "@/api/errors"

/**
 * A member's name and face, edited by an administrator (TSSR-80).
 *
 * <h2>⚠️ What is deliberately not here</h2>
 *
 * <p>Whether a client follows its owner or stands on its own, which grants it holds, which tools it
 * may call — none of that. Those are the AI screen's, over the shared `/api/ai/agents/**` surface, and
 * a second control over one row is how two screens come to disagree about what an agent holds. This
 * dialog answers what the row <strong>is</strong>: what it is called and what it looks like.
 *
 * <h2>⚠️ Renaming a client is not the same write as renaming a person</h2>
 *
 * <p>It looks the same from here and is not underneath: the server sends a client's rename through the
 * agent directory so the member row <em>follows</em>, which is what makes every by-line it has ever
 * left read the new name. Writing the row directly would leave last month's threads printing last
 * month's name — the failure `agent_name`-as-a-snapshot was replaced to escape.
 *
 * <p>⚠️ <strong>An administrator may rename somebody else's client</strong>, decided 2026-08-18. There
 * is deliberately no ownership check here or behind it, and Tessera keeps no record of the rename —
 * `TSSR-81` proposed one and was ruled Won't Do.
 */
export function MemberEditDialog({
  member,
  open,
  onOpenChange,
}: {
  member: MemberSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState("")

  /** The file somebody picked, held until they have framed it. Null means the picker is showing. */
  const [chosenPicture, setChosenPicture] = useState<File | null>(null)
  const cropper = useRef<ImageCropperHandle>(null)

  /** The face being tried on, before it is applied. Null means nothing has been touched yet. */
  const [chosenFace, setChosenFace] = useState<string | null>(null)

  // Re-seeded whenever a different member is opened. Without this the field keeps whatever was typed
  // into it for the previous row, which is the worst possible default on a rename.
  useEffect(() => {
    setDisplayName(member?.displayName ?? "")
    setChosenFace(null)
  }, [member?.id, member?.displayName])

  function refreshMembers() {
    void queryClient.invalidateQueries({ queryKey: ["members"] })
  }

  const rename = useMutation({
    mutationFn: () => renameMember(member!.id, displayName.trim()),
    onSuccess: () => {
      refreshMembers()
      toast.success("Renamed")
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not rename this member")),
  })

  const choosePreset = useMutation({
    mutationFn: (seed: string) => chooseAvatarPresetFor(member!.id, seed),
    onSuccess: refreshMembers,
    onError: (error) => toast.error(apiErrorMessage(error, "Could not change the face")),
  })

  const uploadPicture = useMutation({
    // ⚠️ Squared and downscaled here. The server's ceiling is a megabyte, which a phone photograph
    // clears by an order of magnitude — sending the original means a refusal rather than a slow upload.
    //
    // ⚠️ The crop comes from the cropper, not from the file somebody chose. An earlier version tried
    // to square the file itself, and a centre crop is precisely the thing a cropper exists to avoid.
    mutationFn: async (picture: Blob) => uploadAvatarPictureFor(member!.id, picture),
    onSuccess: () => {
      setChosenPicture(null)
      refreshMembers()
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not upload the picture")),
  })

  if (!member) {
    return null
  }

  const client = isAgent(member)
  const changed = displayName.trim() !== (member.displayName ?? "") && displayName.trim() !== ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ⚠️ `grid-cols-[minmax(0,1fr)]` — `DialogContent` is a grid and a grid item's automatic minimum
          size is its min-content width, so without it a long name pushes the dialog past its own border
          (TSSR-75). */}
      <DialogContent className="grid-cols-[minmax(0,1fr)] max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex min-w-0 items-center gap-2">
            <MemberAvatar member={member} className="size-8 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{member.displayName ?? member.email}</span>
          </DialogTitle>
          <DialogDescription>
            {client
              ? "A client. What it may do is decided on the AI screen; what it is called and what it looks like is decided here."
              : "A person in this installation."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="member-name">Name</Label>
          <Input
            id="member-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="What this member is called"
          />
          {client && (
            <p className="text-xs text-muted-foreground">
              Renaming writes through the agent directory, so every by-line this client has ever left
              starts reading the new name — which is what a name is for here.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Face</Label>

          {/* ⚠️ A generated face is the ordinary case for a client, not a fallback: it is provisioned
              wearing one seeded from its own identifier, so two clients of one person are told apart at
              a glance and neither wears the face of the person who was asleep at the time.

              ⚠️ The SAME picker the account screen uses. This was a flat row of twelve classic faces
              until 2026-08-24 — the shape it had before there was anything to choose between — which
              meant an administrator dressing a client could reach one of eight strategies and none of
              the controls. A second, lesser picker over the same column is how two screens come to
              disagree about what a face can be. */}
          <AvatarPicker
            value={chosenFace ?? (member.avatar.kind === "PRESET" ? member.avatar.preset : null)}
            onChange={setChosenFace}
            seedHint={member.displayName ?? member.email ?? undefined}
          />

          {/* ⚠️ Applied on a button rather than on every change. The account screen has a Save in its
              footer; this dialog's footer belongs to the rename, so the face needs its own — and
              writing on each control tweak would put a request behind every drag of a slider. */}
          <Button
            type="button"
            size="sm"
            disabled={
              !chosenFace ||
              chosenFace === (member.avatar.kind === "PRESET" ? member.avatar.preset : null) ||
              choosePreset.isPending
            }
            onClick={() => chosenFace && choosePreset.mutate(chosenFace)}
          >
            Use this face
          </Button>

          {chosenPicture ? (
            /* ⚠️ The same cropper the account screen uses, rather than an automatic centre crop.
               People are rarely centred in their own photographs, and a face sliced down the middle is
               worse than no picture — the argument is written out in `@jmouse/ui`'s `ImageCropper`. */
            <div className="space-y-2">
              <ImageCropper
                ref={cropper}
                source={chosenPicture}
                specification={AVATAR_CROP}
                stageHeight={240}
                onDiscard={() => setChosenPicture(null)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={uploadPicture.isPending}
                  onClick={async () => {
                    if (cropper.current) {
                      uploadPicture.mutate(await cropper.current.toBlob())
                    }
                  }}
                >
                  Use this crop
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setChosenPicture(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <label className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent">
              {/* The native control renders the operating system's own grey box and "No file chosen"
                  beside it, in a shape nothing else here uses and which cannot be styled. The label is
                  the button; the input lives inside it, hidden. */}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadPicture.isPending}
                onChange={(event) => {
                  const picture = event.target.files?.[0]

                  if (picture) {
                    setChosenPicture(picture)
                  }
                }}
              />
              Upload a picture
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!changed || rename.isPending}
            onClick={() => rename.mutate()}
          >
            Save the name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
