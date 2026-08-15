import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Dices, ImageUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SegmentedControl } from "@/components/SegmentedControl"
import { PixelFace } from "@/components/PixelFace"
import { ImageSquareCropper, type CropperHandle } from "@/components/account/ImageSquareCropper"
import { PRESET_SEEDS, rollSeed } from "@/lib/pixelFace"
import { apiErrorMessage } from "@/api/errors"
import { cn } from "@/lib/helpers"
import { chooseAvatarPreset, clearAvatar, uploadAvatarPicture } from "@/api/members"

type Source = "faces" | "picture"

const SOURCES = [
  { value: "faces" as const, label: "Pixel faces" },
  { value: "picture" as const, label: "Your own picture" },
]

/** How many more faces a roll adds. Enough to change the grid, few enough to still scan it. */
const ROLL_SIZE = 8

/**
 * Choosing a face.
 *
 * Two sources, one dialog, because they are one decision — a person opens this wanting to stop being
 * two grey letters and does not care which mechanism gets them there. Splitting them into separate
 * screens would make picking a generated face feel like a lesser path to the "real" feature, when for
 * most people it is the whole feature.
 *
 * ⚠️ **Selecting is not saving.** A click on a face marks it and nothing more; the dialog closes on
 * Save. Faces are cheap to render but a choice is not cheap to undo once fourteen other screens are
 * showing it, and an accidental click while scanning a grid of thirty-two is exactly the kind of thing
 * a grid of thirty-two invites.
 */
export function AvatarPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const [source, setSource] = useState<Source>("faces")
  const [seeds, setSeeds] = useState<string[]>(PRESET_SEEDS)
  const [chosenSeed, setChosenSeed] = useState<string | null>(null)
  const [picture, setPicture] = useState<File | null>(null)

  const cropper = useRef<CropperHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Re-open clean. A dialog that remembers what was half-chosen last time offers a stale answer to a
  // question that has since been answered.
  useEffect(() => {
    if (open) {
      setSource("faces")
      setSeeds(PRESET_SEEDS)
      setChosenSeed(null)
      setPicture(null)
    }
  }, [open])

  const settled = () => {
    // ⚠️ `useCurrentMember` is cached with `staleTime: Infinity`, so nothing refetches on its own — an
    // avatar changed without this invalidation is a face that only appears after a reload.
    queryClient.invalidateQueries({ queryKey: ["current-member"] })
    // Every listing embeds a member summary, so all of them now carry a stale face.
    queryClient.invalidateQueries()
    onOpenChange(false)
  }

  const failed = (error: unknown) => toast.error(apiErrorMessage(error, "That avatar could not be saved."))

  const savePreset = useMutation({
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

  const isSaving = savePreset.isPending || savePicture.isPending || dropBackToInitials.isPending

  const canSave = source === "faces" ? chosenSeed !== null : picture !== null

  const save = async () => {
    if (source === "faces" && chosenSeed) {
      savePreset.mutate(chosenSeed)
      return
    }

    if (source === "picture" && cropper.current) {
      try {
        savePicture.mutate(await cropper.current.toSquarePng())
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That picture could not be cropped.")
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your face</DialogTitle>
          <DialogDescription>
            Pick one of the generated faces, or upload a picture and crop it square.
          </DialogDescription>
        </DialogHeader>

        <SegmentedControl
          segments={SOURCES}
          value={source}
          onChange={setSource}
          ariaLabel="Where your avatar comes from"
          fill
        />

        {source === "faces" && (
          <div className="space-y-3">
            {/*
              ⚠️ The padding is load-bearing, not decoration. Both the hover scale and the selection
              ring are painted OUTSIDE a button's box, and a scrolling box counts that as overflow.
              Without room to grow, hovering a face summoned a scrollbar, the scrollbar reflowed the
              grid out from under the cursor, the hover ended, the scrollbar left — a flicker loop.
              An overlaid scrollbar makes that harder to reach, but the padding is what settles it.
            */}
            <ScrollArea viewportClassName="max-h-72">
              <div className="grid w-full grid-cols-8 gap-2 p-1.5">
                {seeds.map((seed) => (
                  <button
                    key={seed}
                    type="button"
                    title={seed}
                    onClick={() => setChosenSeed(seed)}
                    aria-pressed={chosenSeed === seed}
                    className={cn(
                      "aspect-square overflow-hidden rounded-full ring-2 ring-transparent transition",
                      "hover:scale-105 focus-visible:ring-ring focus-visible:outline-none",
                      chosenSeed === seed && "ring-primary"
                    )}
                  >
                    <PixelFace seed={seed} />
                  </button>
                ))}
              </div>
            </ScrollArea>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSeeds((existing) => [...existing, ...Array.from({ length: ROLL_SIZE }, rollSeed)])}
            >
              <Dices className="size-4" />
              Roll more
            </Button>
          </div>
        )}

        {source === "picture" && (
          <div className="space-y-3">
            {picture ? (
              <ImageSquareCropper ref={cropper} file={picture} onDiscard={() => setPicture(null)} />
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
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={() => dropBackToInitials.mutate()}
          >
            Use my initials
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={!canSave || isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
