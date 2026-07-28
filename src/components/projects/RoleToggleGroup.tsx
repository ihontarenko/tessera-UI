import type { RoleSummary } from "@/api/projects"
import { cn } from "@/lib/helpers"

interface RoleToggleGroupProperties {
  roles: RoleSummary[]
  selectedIds: string[]
  onToggle: (roleId: string) => void
}

/** Multi-select role picker as toggle pills — reused by both the add and manage access dialogs. */
export function RoleToggleGroup({ roles, selectedIds, onToggle }: RoleToggleGroupProperties) {
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => {
        const selected = selectedIds.includes(role.id)

        return (
          <button
            type="button"
            key={role.id}
            onClick={() => onToggle(role.id)}
            aria-pressed={selected}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {role.name}
          </button>
        )
      })}
    </div>
  )
}
