import { EmojiPickerButton, Label } from "@jmouse/ui"
import { useLanguage } from "@/context/LanguageContext"

/**
 * How a project's emoji is chosen (TSSR-7): the label, the hint, and `@jmouse/ui`'s picker between them.
 *
 * <h2>⚠️ This used to be a text field and two dozen presets, and both are gone</h2>
 *
 * The presets were a shortlist with the tone of the things a tracker holds — a service, a release, a bug
 * hunt — and they made the common case one click. What they could not do is answer *the emoji I actually
 * want*, so the field beside them existed to catch everything else, which meant a control somebody had to
 * choose between two halves of. The library picker is the whole set with a tag search over it, and it
 * still takes a pasted character: paste into its search box and it offers what you pasted.
 *
 * <p>⚠️ **It lives in `@jmouse/ui` rather than here**, because Kiwi's sections and Innoventa's form
 * glyphs are the same control, and three hand-rolled palettes is how three products come to disagree
 * about what an icon field is. This file is now what remains after the shared half left: the strings.
 *
 * <p>⚠️ **Whether the value is a single emoji is the server's answer, not this component's.** A grapheme
 * cluster count is not something worth having two implementations of, and the refusal it sends back says
 * exactly what is wrong.
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

      <div>
        <EmojiPickerButton
          id={inputId}
          size="lg"
          value={icon}
          disabled={disabled}
          // ⚠️ Empty rather than null: the form around this stores a string, and a project with no icon
          // is one whose column is blank — never one whose column is missing.
          onChange={(chosen) => onChange(chosen ?? "")}
          recentStorageKey="tessera.emoji.recent"
          labels={{
            open: t("project.icon.open", "Choose an icon"),
            search: t("emoji.search", "Search emoji…"),
            empty: t("emoji.empty", "Nothing matches that."),
            useTyped: t("emoji.useTyped", "Use {emoji}"),
            recent: t("emoji.recent", "Recent"),
            clear: t("project.icon.clear", "No icon"),
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t("project.icon.hint", "One emoji. Leave it empty for the default folder mark.")}
      </p>
    </div>
  )
}
