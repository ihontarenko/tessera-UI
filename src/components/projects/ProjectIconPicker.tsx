import { X } from "lucide-react"
import { Input, Label } from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/helpers"

/**
 * A palette of ready-made emoji, with the tone of the things a tracker actually holds — a service, a
 * release, a bug hunt, a design job. It is not a taxonomy and nothing reads it: it is the shortlist that
 * makes the common case one click instead of a trip to the system picker.
 */
const PRESETS = [
  "🚀", "📦", "🧩", "🛠️", "⚙️", "🔬",
  "🐞", "🔥", "💡", "🎯", "📊", "🗂️",
  "🌍", "🔐", "💳", "📱", "🖥️", "🎨",
  "📝", "🤖", "⚡", "🧪", "🏗️", "🎬",
]

/**
 * How a project's emoji is chosen (TSSR-7): a field, and a palette beside it.
 *
 * Both, deliberately. The field alone means a trip to the operating system's picker (`Win+.`) for what is
 * usually one of a dozen obvious choices; the palette alone would make somebody's own emoji unreachable,
 * and the whole point of the field is that it is theirs. The field is the source of truth — clicking a
 * preset writes into it, and nothing is stored until the form around this saves.
 *
 * ⚠️ **Whether the value is a single emoji is the server's answer, not this component's.** A grapheme
 * cluster count is not something worth having two implementations of, and the refusal it sends back says
 * exactly what is wrong. This only stops the obviously-too-long, which the column's width already implies.
 */
export function ProjectIconPicker({
  icon,
  onChange,
  inputId = "project-icon",
  disabled = false,
}: {
  icon: string
  onChange: (icon: string) => void
  inputId?: string
  disabled?: boolean
}) {
  const { t } = useLanguage()

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{t("project.settings.general.icon", "Icon")}</Label>

      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          value={icon}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          maxLength={16}
          placeholder={t("project.icon.placeholder", "Paste an emoji…")}
          className="w-28 text-center text-lg"
        />

        {icon.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="size-3.5" /> {t("project.icon.clear", "Clear")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 pt-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => onChange(preset)}
            aria-label={preset}
            aria-pressed={icon === preset}
            className={cn(
              "flex size-8 items-center justify-center rounded-md border text-base transition-colors",
              "hover:border-primary/40 hover:bg-accent disabled:opacity-50",
              icon === preset ? "border-primary bg-accent" : "border-transparent",
            )}
          >
            {preset}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("project.icon.hint", "One emoji. Leave it empty for the default folder mark.")}
      </p>
    </div>
  )
}
