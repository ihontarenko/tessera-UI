import { cn } from "@/lib/helpers"

/**
 * One entry in a side-column section picker — Administration's catalogs, a project's settings, the
 * workflow list inside Administration.
 *
 * ⚠️ **Sized from `SidebarMenuButton`, deliberately, and not invented here.** These pickers were
 * `px-3 py-2 text-sm` while the application's own navigation is `px-2.5 py-[7px] text-[13px]`, so the
 * second-level list drew *larger* than the first — which reads as the inner column being the more
 * important of the two, and it is not. The numbers are copied from `components/ui/sidebar.tsx`; if that
 * button is ever resized, this is the one place that follows it.
 *
 * A shared function rather than a copied string: three call sites had the same class list written out
 * three times, which is three chances for the next change to land on two of them.
 */
export function sectionNavigationItemClass(isActive: boolean): string {
  return cn(
    "w-full rounded-md px-2.5 py-[7px] text-left text-[13px] whitespace-nowrap transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  )
}
