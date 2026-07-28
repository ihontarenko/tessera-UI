import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { AuthProvider } from "react-oidc-context"
import type { User } from "oidc-client-ts"
import { userManager } from "@/auth/userManager"

interface AuthProviderWithNavigateProperties {
  children: ReactNode
}

/**
 * Must render inside <BrowserRouter> — onSigninCallback needs useNavigate to land the user back
 * on the page they started from (round-tripped through OIDC's `state`) instead of staying on the
 * bare /login/oauth2/code/identity callback path after the code exchange completes.
 */
export function AuthProviderWithNavigate({ children }: AuthProviderWithNavigateProperties) {
  const navigate = useNavigate()

  const handleSigninCallback = (user: User | undefined) => {
    const returnPath = typeof user?.state === "string" ? user.state : "/"
    navigate(returnPath, { replace: true })
  }

  return (
    <AuthProvider userManager={userManager} onSigninCallback={handleSigninCallback}>
      {children}
    </AuthProvider>
  )
}
