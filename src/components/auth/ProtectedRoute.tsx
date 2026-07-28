import { useEffect, useRef, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "react-oidc-context"
import { Skeleton } from "@/components/ui/skeleton"

interface ProtectedRouteProperties {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProperties) {
  const auth = useAuth()
  const location = useLocation()
  const hasStartedSigninRedirect = useRef(false)

  useEffect(() => {
    // React StrictMode double-invokes effects in development — auth.activeNavigator only flips
    // true once signinRedirect's async work updates context, so both invocations can pass that
    // check before either does, firing two concurrent (and racing) authorize redirects. This ref
    // is a synchronous guard neither invocation can slip past.
    if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !hasStartedSigninRedirect.current) {
      hasStartedSigninRedirect.current = true
      void auth.signinRedirect({ state: location.pathname })
    }
  }, [auth, location.pathname])

  if (auth.isAuthenticated) {
    return children
  }

  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 p-8">
      <div className="w-full max-w-sm space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}
