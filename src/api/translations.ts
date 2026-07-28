import { useQuery } from "@tanstack/react-query"
import { centralClient } from "@/api/centralClient"

/**
 * Tessera consumes shared UI copy from Central's public read contract:
 * GET /api/translations?application=&lang= — a flat Map<string, string>, no wrapper DTO. Central
 * owns the editorial workflow (its own admin screen); Tessera is a read-only consumer, exactly like
 * Moneta. The request goes through {@link centralClient}, which targets Central rather than Tessera's
 * own backend and never redirects on failure — a missing map just falls back to English copy.
 */
export function fetchTranslations(application: string, language: string) {
  return centralClient
    .get<Record<string, string>>("/translations", { params: { application, lang: language } })
    .then((response) => response.data)
}

export function useTranslations(application: string, language: string) {
  return useQuery({
    queryKey: ["translations", application, language],
    queryFn: () => fetchTranslations(application, language),
    staleTime: Infinity,
    retry: false,
  })
}
