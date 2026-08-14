import { cn } from "@/lib/helpers"
import { PROJECT_ROLES, roleLabel } from "@/api/roles"

interface ProjectRolePickerProperties {
  selected: string[]
  onToggle: (roleName: string) => void
  disabled?: boolean
}

/**
 * The three roles a project hands out, as toggle pills — used by the add dialog and, inline, by the
 * people table.
 *
 * ⚠️ **It fetches nothing.** It used to read `/project-roles`, a table of rows whose identifiers this
 * picker then sent back; the table is gone and a role is addressed by the name the policy document
 * writes. Which three a project may hand out is a fact of the model, not a query — see `api/roles.ts`.
 */
export function ProjectRolePicker({ selected, onToggle, disabled = false }: ProjectRolePickerProperties) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROJECT_ROLES.map((roleName) => {
        const held = selected.includes(roleName)

        return (
          <button
            type="button"
            key={roleName}
            disabled={disabled}
            onClick={() => onToggle(roleName)}
            aria-pressed={held}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              held
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
              disabled ? "cursor-default opacity-70" : "hover:text-foreground",
            )}
          >
            {roleLabel(roleName)}
          </button>
        )
      })}
    </div>
  )
}
