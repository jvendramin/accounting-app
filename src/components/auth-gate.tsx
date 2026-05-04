"use client"

import { auth } from "@/lib/auth"
import { LoginForm } from "@/components/login-form"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = auth.useSession()

  if (session.isPending) {
    return <div className="min-h-svh bg-background" />
  }

  if (!session.data) {
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
