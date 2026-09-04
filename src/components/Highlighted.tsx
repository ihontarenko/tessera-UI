import { Fragment, useMemo } from "react"

/**
 * A passage with the searched words marked in it.
 *
 * ⚠️ **The marking happens here and not on the server**, which is the whole reason snippets come back as
 * plain text. The same strings are read by a person on this screen, and by a model through the protocol;
 * only one of those wants markup, and a payload carrying `<mark>` would be a payload a model has to
 * strip before it can quote anything.
 *
 * ⚠️ **Split, never `dangerouslySetInnerHTML`.** A page's own prose is in these passages, so building
 * HTML out of it and injecting it is an injection hole opened for the sake of a yellow background. The
 * text is cut into runs and React renders each one, which cannot inject anything by construction.
 */
export function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const runs = useMemo(() => split(text, terms), [text, terms])

  return (
    <>
      {runs.map((run, index) => (
        <Fragment key={index}>
          {run.marked ? (
            // Not a yellow highlighter: the family's own accent, at a weight that reads as emphasis in
            // both themes rather than as a second background competing with the row's.
            <mark className="bg-primary/15 font-medium text-foreground">{run.text}</mark>
          ) : (
            run.text
          )}
        </Fragment>
      ))}
    </>
  )
}

/**
 * The text cut into marked and unmarked runs.
 *
 * ⚠️ **One pass over the string rather than a regular expression per term.** A term is whatever somebody
 * typed — `c++`, `*.jmp`, `(n | double)` — and every one of those is a regular expression that either
 * throws or matches the wrong thing. Nothing here is compiled, so nothing here can be an expression.
 */
function split(text: string, terms: string[]): Array<{ text: string; marked: boolean }> {
  const wanted = terms.filter((term) => term.length > 0).map((term) => term.toLowerCase())

  if (wanted.length === 0) {
    return [{ text, marked: false }]
  }

  const folded = text.toLowerCase()
  const runs: Array<{ text: string; marked: boolean }> = []

  let at = 0

  while (at < text.length) {
    const next = wanted
      .map((term) => ({ term, index: folded.indexOf(term, at) }))
      .filter((candidate) => candidate.index >= 0)
      // The earliest match wins, and the longest of the ones starting together — so a query carrying
      // both "page" and "pages" marks the whole word rather than four fifths of it.
      .sort(
        (first, second) => first.index - second.index || second.term.length - first.term.length,
      )[0]

    if (!next) {
      runs.push({ text: text.slice(at), marked: false })
      break
    }

    if (next.index > at) {
      runs.push({ text: text.slice(at, next.index), marked: false })
    }

    runs.push({ text: text.slice(next.index, next.index + next.term.length), marked: true })

    at = next.index + next.term.length
  }

  return runs
}
