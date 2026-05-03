import { auth } from "@/lib/auth"
import { LoginForm } from "@/components/login-form"

function LoginScreen() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <div className="flex items-center gap-2 font-medium">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
              B
            </div>
            Books
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          src="/login-bg.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = auth.useSession()

  if (session.isPending) {
    return (
      <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!session.data) return <LoginScreen />

  return <>{children}</>
}
