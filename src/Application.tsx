import { BrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { AuthProviderWithNavigate } from "@/auth/AuthProviderWithNavigate"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { ThemeProvider, Toaster } from "@jmouse/ui"
import { repaintMark } from "@/lib/favicon"
import { allThemes } from "@jmouse/ui/presets"
import { LanguageProvider } from "@/context/LanguageContext"
import { AppRoutes } from "@/router"
import { QueryTransportProvider } from "@jmouse/query"
import { queryTransport } from "@/lib/queryTransport"

export function Application() {
  return (
    <ThemeProvider themes={allThemes} storagePrefix="tessera" onThemeApplied={repaintMark}>
      <BrowserRouter>
        <AuthProviderWithNavigate>
          <QueryClientProvider client={queryClient}>
            {/*
              ⚠️ At the root rather than beside the panel that uses it: the filter builder will appear on
              more than one screen, and every one of them must reach the backend through the SAME client
              — the one that carries the bearer token.
            */}
            <QueryTransportProvider value={queryTransport}>
              <ProtectedRoute>
                <LanguageProvider>
                  <AppRoutes />
                </LanguageProvider>
              </ProtectedRoute>
            </QueryTransportProvider>
            <Toaster />
          </QueryClientProvider>
        </AuthProviderWithNavigate>
      </BrowserRouter>
    </ThemeProvider>
  )
}
