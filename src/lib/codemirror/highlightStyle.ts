import { HighlightStyle } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import {
  policyAction,
  policyCapability,
  policyDeny,
  policyInstance,
  policyKeyword,
  policyNamespace,
  policyRole,
  policyScope,
  policyStatementKind,
  policySubject,
} from "./tags"

/**
 * The one syntax palette, as rules over `--syntax-*` tokens.
 *
 * <h2>Why code has its own tokens instead of the product's</h2>
 *
 * <p>The obvious thing is to paint from `--primary` / `--destructive` / `--muted-foreground`, so
 * highlighting follows the active theme. Innoventa did exactly that and it followed the theme into
 * places code cannot go: on a palette whose accent *is* its secondary, keywords and strings came out
 * the same colour, and on the darker themes a whole class of token landed a few percent from the
 * background. Decorative colour and legible colour are two different jobs, and only one of them may
 * be chosen for looks.
 *
 * <p>So syntax colour is normalised — declared once in `components/markdown/markdown.css` for light
 * and for dark, and left alone by all 27 themes. ⚠️ Which means picking a theme recolours the *frame*
 * around code and never the code itself, and that is the intended outcome rather than a gap.
 *
 * <p>The palette is Innoventa's house set, ported verbatim, for the same reason its 27 themes were:
 * it is already tuned for legibility on both grounds, and inventing a second one would mean two
 * products' code reading differently for no reason anybody could name.
 *
 * <p>⚠️ **One style, both surfaces.** The editor colours what is being written and
 * {@link ./staticHighlight} colours the fenced blocks it produced, and both resolve *this* object —
 * so a snippet cannot read one way while typed and another way once saved.
 */
export const TESSERA_HIGHLIGHT_STYLE = HighlightStyle.define([
  // ── Structure — comments and plumbing recede ─────────────────────────────
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--syntax-comment)",
    fontStyle: "italic",
  },
  { tag: [tags.meta, tags.processingInstruction], color: "var(--syntax-punctuation)" },

  // ── The standard set ─────────────────────────────────────────────────────
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.operatorKeyword,
      tags.modifier,
      tags.namespace,
      tags.function(tags.variableName),
      tags.typeName,
      tags.className,
    ],
    color: "var(--syntax-keyword)",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character],
    color: "var(--syntax-string)",
  },
  { tag: [tags.number, tags.bool, tags.atom, tags.null], color: "var(--syntax-literal)" },
  { tag: [tags.variableName], color: "var(--syntax-variable)" },
  {
    tag: [tags.definition(tags.variableName)],
    color: "var(--syntax-declaration)",
    fontWeight: "600",
  },
  {
    tag: [tags.propertyName, tags.attributeName, tags.labelName],
    color: "var(--syntax-property)",
  },
  { tag: [tags.operator, tags.separator], color: "var(--syntax-operator)" },
  { tag: [tags.punctuation], color: "var(--syntax-punctuation)" },
  { tag: [tags.invalid], color: "var(--syntax-invalid)" },

  // ── Policy (.jmp) — declared after the standard set, so these win ────────
  //
  // ⚠️ A tracker colours this language because a ticket about authorization *is* a ```jmp fence, not
  // because Tessera has any opinion about policy. Every rule below is Innoventa's, kept identical on
  // purpose: the same file read in two products should not be two colours.
  { tag: [policyKeyword], color: "var(--syntax-keyword)", fontWeight: "600" },

  // The keyword's own colour, on purpose. `declare` / `assign` do not name a thing — they say what
  // KIND the block beside them is — so a second hue would have made a label look like a subject.
  // Slant and weight separate them when the eye is scanning the margin and stay out of the way when
  // it is reading a line.
  {
    tag: [policyStatementKind],
    color: "var(--syntax-namespace)",
    textDecoration: "underline",
    fontWeight: "500",
  },
  // Loud on purpose. A denial is the one statement whose consequence cannot be undone by any other
  // line in the file, and a palette that lets it blend in has mis-ranked the whole document.
  { tag: [policyDeny], color: "var(--syntax-deny)", fontWeight: "700" },
  { tag: [policyRole], color: "var(--syntax-role)", fontWeight: "600" },
  { tag: [policySubject], color: "var(--syntax-subject)" },
  { tag: [policyScope], color: "var(--syntax-scope)", fontWeight: "600" },
  { tag: [policyInstance], color: "var(--syntax-instance)" },
  { tag: [policyNamespace], color: "var(--syntax-namespace)" },
  { tag: [policyAction], color: "var(--syntax-action)" },
  // The namespace colour, on purpose: a capability key sits where a permission's namespace sits — the
  // subject of the line — and one policy file should not need two vocabularies of colour to be read.
  // Separate tags so a palette can split them later without touching the grammar.
  { tag: [policyCapability], color: "var(--syntax-namespace)" },

  // ── The Markdown surface itself — what the source editor is mostly showing ──
  { tag: [tags.heading], color: "var(--syntax-heading)", fontWeight: "700" },
  { tag: [tags.strong], color: "var(--syntax-heading)", fontWeight: "700" },
  { tag: [tags.emphasis], fontStyle: "italic" },
  { tag: [tags.strikethrough], textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--syntax-namespace)", textDecoration: "underline" },
  { tag: [tags.monospace], color: "var(--syntax-keyword)" },
  { tag: [tags.quote], color: "var(--syntax-comment)" },
  { tag: [tags.list], color: "var(--syntax-operator)" },
])
