import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImageUp } from "lucide-react"
import { toast } from "sonner"
import { AvatarPickerDialog as SharedAvatarPickerDialog, type AvatarChoice } from "@jmouse/avatars/picker"
import { AVATAR_CROP, ImageCropper, type ImageCropperHandle } from "@jmouse/ui"
import { useCurrentMember } from "@/hooks/useCurrentMember"
import { apiErrorMessage } from "@/api/errors"
import { chooseAvatarPreset, clearAvatar, uploadAvatarPicture } from "@/api/members"

/**
 * Choosing a face — the half only Tessera can do.
 *
 * ⚠️ **The dialog itself lives in `@jmouse/avatars/picker`, and the cropper in `@jmouse/ui`.** What was
 * here was 245 lines, of which the strategy strip, the controls, the variant grid and the chrome were
 * identical to Kiwi's and to Innoventa's — three copies drifting apart with nothing anywhere saying so.
 * The cropper was the last of them to go, and it was the worst: 345 lines byte-identical in three
 * products. What stays is everything a shared part cannot know — this product's routes, its error
 * shape and its cache invalidation.
 */
export function AvatarPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: member } = useCurrentMember()

  const [picture, setPicture] = useState<File | null>(null)

  const cropper = useRef<ImageCropperHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const settled = () => {
    // ⚠️ `useCurrentMember` is cached with `staleTime: Infinity`, so nothing refetches on its own — an
    // avatar changed without this invalidation is a face that only appears after a reload.
    queryClient.invalidateQueries({ queryKey: ["current-member"] })
    // Every listing embeds a member summary, so all of them now carry a stale face.
    queryClient.invalidateQueries()
    setPicture(null)
    onOpenChange(false)
  }

  const failed = (error: unknown) => toast.error(apiErrorMessage(error, "That avatar could not be saved."))

  const saveGenerated = useMutation({
    mutationFn: chooseAvatarPreset,
    onSuccess: () => {
      toast.success("New face on.")
      settled()
    },
    onError: failed,
  })

  const savePicture = useMutation({
    mutationFn: uploadAvatarPicture,
    onSuccess: () => {
      toast.success("Picture uploaded.")
      settled()
    },
    onError: failed,
  })

  const dropBackToInitials = useMutation({
    mutationFn: clearAvatar,
    onSuccess: () => {
      toast.success("Back to initials.")
      settled()
    },
    onError: failed,
  })

  const saving = saveGenerated.isPending || savePicture.isPending || dropBackToInitials.isPending

  const submit = async (choice: AvatarChoice) => {
    if (choice.kind === "generated") {
      saveGenerated.mutate(choice.token)
      return
    }

    if (choice.kind === "initials") {
      dropBackToInitials.mutate()
      return
    }

    if (!cropper.current) {
      return
    }

    try {
      savePicture.mutate(await cropper.current.toBlob())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That picture could not be cropped.")
    }
  }

  return (
    <SharedAvatarPickerDialog
      open={open}
      onOpenChange={onOpenChange}
      value={member?.avatar.kind === "PRESET" ? member.avatar.preset : null}
      seedHint={member?.displayName ?? member?.email ?? undefined}
      pictureReady={picture !== null}
      saving={saving}
      onSubmit={submit}
      pictureSource={
        <div className="space-y-3">
          {picture ? (
            <ImageCropper
              ref={cropper}
              source={picture}
              specification={AVATAR_CROP}
              stageHeight={260}
              onDiscard={() => setPicture(null)}
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <ImageUp className="size-6" />
              Choose a picture
              <span className="text-xs">PNG, JPEG, WebP or GIF</span>
            </button>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const chosen = event.target.files?.[0]
              setPicture(chosen ?? null)
              // Cleared so choosing the SAME file after discarding it fires a change event again.
              event.target.value = ""
            }}
          />
        </div>
      }
    />
  )
}
