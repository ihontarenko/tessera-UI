import { BrowserRouter } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from "@/lib/queryClient"
import { AuthProviderWithNavigate } from "@/auth/AuthProviderWithNavigate"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { ThemeProvider } from "@/context/ThemeContext"
import { LanguageProvider } from "@/context/LanguageContext"
import { AppRoutes } from "@/router"

export function Application() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProviderWithNavigate>
          <QueryClientProvider client={queryClient}>
            <ProtectedRoute>
              <LanguageProvider>
                <AppRoutes />
              </LanguageProvider>
            </ProtectedRoute>
            <Toaster />
          </QueryClientProvider>
        </AuthProviderWithNavigate>
      </BrowserRouter>
    </ThemeProvider>
  )
}
