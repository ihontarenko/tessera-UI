import { useMemo } from "react"
import { pixelFace } from "@/lib/pixelFace"
import { cn } from "@/lib/helpers"

interface PixelFaceProperties {
  /** The string the face is drawn from. Any string works; the same one always draws the same face. */
  seed: string
  className?: string
}

/**
 * A generated pixel face, drawn as SVG.
 *
 * Inline SVG rather than an image: there is nothing to fetch, nothing to cache and nothing to go
 * missing, and the whole face is around thirty rectangles. A member list of forty people costs forty
 * memoised arrays and no requests at all.
 *
 * ⚠️ `shapeRendering="crispEdges"` is load-bearing. Without it the browser antialiases a 12-unit grid
 * scaled to 28 pixels and every hard edge turns to mush — which is the difference between pixel art and
 * a smudge.
 */
export function PixelFace({ seed, className }: PixelFaceProperties) {
  const face = useMemo(() => pixelFace(seed), [seed])

  return (
    <svg
      viewBox={`0 0 ${face.size} ${face.size}`}
      className={cn("size-full", className)}
      shapeRendering="crispEdges"
      role="presentation"
      aria-hidden="true"
    >
      <rect width={face.size} height={face.size} fill={face.background} />
      {face.runs.map((run) => (
        <rect
          key={`${run.y}-${run.x}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={run.fill}
        />
      ))}
    </svg>
  )
}
