import type { ReactNode } from "react"
import { Check, Snowflake } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/PageHeader"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useTheme } from "@/context/ThemeContext"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/helpers"
import { darkThemes, lightThemes, seasonalThemes, type ContrastMode, type FontScale } from "@/theming"

const FONT_SCALES: Array<{ value: FontScale; label: string }> = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
  { value: "xlarge", label: "XL" },
]

const CONTRAST_MODES: Array<{ value: ContrastMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

const MODES: Array<{ value: "light" | "dark" | "system"; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

/**
 * Everything the interface looks like, on one screen.
 *
 * ⚠️ **Compact on purpose, and it used to be the opposite.** Every section was a `Card` with its own
 * header, padding and shadow, and the swatch grid stretched to whatever width the display had — on a
 * wide screen a row of five themes spanned two thousand pixels, so choosing one meant crossing the
 * monitor. Six cards for six one-line settings is a page you scroll to find a toggle.
 *
 * What replaced them: one measured column, plain rules between sections rather than boxes, the three
 * one-choice settings (mode, text size, contrast) on a single row, and swatches sized to their labels
 * so the eye can take a palette in at a glance instead of scanning.
 *
 * A page rather than the dropdown it started as — that content is tall enough that positioning it in a
 * popover was a fight (see `SidebarPopover` for what the font-scale zoom does to a measured panel),
 * and a page has no positioning to get wrong.
 */
export function AppearanceSettingsPage() {
  const {
    mode,
    lightTheme,
    darkTheme,
    fontScale,
    contrastMode,
    seasonalEffectEnabled,
    setMode,
    setLightTheme,
    setDarkTheme,
    setFontScale,
    setContrastMode,
    setSeasonalEffectEnabled,
  } = useTheme()
  const { t } = useLanguage()

  return (
    <>
      <PageHeader title={t("common.appearance", "Appearance")} description="Theme, text size, and contrast" />

      {/* Measured rather than full-bleed: swatch rows that span an ultra-wide display are unreadable. */}
      <div className="max-w-4xl divide-y pt-2">
        {/* The three single-choice settings share one row — each is a handful of words, and stacking
            them into three sections was three headings for three clicks. */}
        <Row>
          <Field label="Mode">
            <SegmentedControl segments={MODES} value={mode} onChange={setMode} ariaLabel="Colour mode" />
          </Field>
          <Field label="Text size">
            <SegmentedControl
              segments={FONT_SCALES}
              value={fontScale}
              onChange={setFontScale}
              ariaLabel="Text size"
            />
          </Field>
          <Field label="Contrast">
            <SegmentedControl
              segments={CONTRAST_MODES}
              value={contrastMode}
              onChange={setContrastMode}
              ariaLabel="Contrast"
            />
          </Field>
        </Row>

        <Section title="Light theme">
          <SwatchGrid>
            {lightThemes.map((theme) => (
              <Swatch
                key={theme.name}
                label={theme.label}
                color={theme.swatchColor}
                selected={lightTheme === theme.name}
                onClick={() => setLightTheme(theme.name)}
              />
            ))}
          </SwatchGrid>
        </Section>

        <Section title="Dark theme">
          <SwatchGrid>
            {darkThemes.map((theme) => (
              <Swatch
                key={theme.name}
                label={theme.label}
                color={theme.swatchColor}
                selected={darkTheme === theme.name}
                onClick={() => setDarkTheme(theme.name)}
              />
            ))}
          </SwatchGrid>
        </Section>

        <Section title="Seasonal">
          <SwatchGrid>
            {seasonalThemes.map((theme) => (
              <Swatch
                key={theme.name}
                label={theme.label}
                color={theme.swatchColor}
                selected={(theme.dark ? darkTheme : lightTheme) === theme.name}
                onClick={() => (theme.dark ? setDarkTheme(theme.name) : setLightTheme(theme.name))}
              />
            ))}
          </SwatchGrid>
          <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Snowflake className="size-4 text-muted-foreground" />
            <span>Seasonal effects</span>
            <Switch checked={seasonalEffectEnabled} onCheckedChange={setSeasonalEffectEnabled} />
          </label>
        </Section>
      </div>
    </>
  )
}

/** A row of side-by-side settings, wrapping on narrow displays. */
function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-x-8 gap-y-4 py-3">{children}</div>
}

/** One labelled control — the label is small and above, so the control itself is what the eye lands on. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</div>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-3">
      <h2 className="mb-2 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Swatches sized to their labels rather than stretched to a column width.
 *
 * `auto-fill` with a small floor means a wide display fits more per row instead of making each one
 * wider — which is what turned this page into a scroll on a large monitor.
 */
function SwatchGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1.5">{children}</div>
}

function Swatch({
  label,
  color,
  selected,
  onClick,
}: {
  label: string
  color: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
        selected ? "border-primary bg-accent text-accent-foreground" : "hover:bg-accent",
      )}
    >
      <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: color }} />
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="size-3.5 shrink-0" />}
    </button>
  )
}
