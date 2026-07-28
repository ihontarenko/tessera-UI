import { useQuery } from "@tanstack/react-query"
import { fetchCurrentMember } from "@/api/members"

/**
 * The current member, sourced from Tessera's own {@code GET /api/members/me} rather than the raw
 * token — this call is also what provisions the member row the first time they sign in.
 */
export function useCurrentMember() {
  return useQuery({
    queryKey: ["current-member"],
    queryFn: fetchCurrentMember,
    staleTime: Infinity,
  })
}
