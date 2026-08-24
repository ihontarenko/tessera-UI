import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { Application } from "./Application.tsx"
import { initialiseCodeAppearance } from "@jmouse/codemirror/react"

// ⚠️ Before the first render: the syntax palette is an attribute on <html>, so a remembered choice
// restored into a store alone is a preference the page never obeys until somebody re-picks it.
initialiseCodeAppearance("tessera.code-appearance")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
