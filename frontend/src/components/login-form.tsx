import { useState } from "react"
import { cn } from "@/lib/utils"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type Mode = "signin" | "signup"

const inputClass = "border-border bg-muted/40"

const Req = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <Label htmlFor={htmlFor}>
    {children} <span className="text-destructive" aria-hidden>*</span>
  </Label>
)

export function LoginForm({
  className,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit">) {
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (mode === "signup" && password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }
    setSubmitting(true)
    try {
      const { error } =
        mode === "signin"
          ? await auth.signIn.email({ email, password })
          : await auth.signUp.email({ email, password, name })
      if (error) {
        toast.error(error.message ?? "Authentication failed")
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const isSignIn = mode === "signin"

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("grid gap-5", className)}
      {...props}
    >
      <div className="grid gap-1 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {isSignIn ? "Login to your account" : "Create an account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignIn
            ? "Enter your email and password below to log in"
            : "Enter your details to sign up"}
        </p>
      </div>
      {!isSignIn && (
        <div className="grid gap-2">
          <Req htmlFor="name">Name</Req>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
      <div className="grid gap-2">
        <Req htmlFor="email">Email</Req>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="grid gap-2">
        <Req htmlFor="password">Password</Req>
        <Input
          id="password"
          type="password"
          autoComplete={isSignIn ? "current-password" : "new-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {!isSignIn && (
        <div className="grid gap-2">
          <Req htmlFor="confirm-password">Confirm Password</Req>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting
          ? isSignIn
            ? "Signing in..."
            : "Creating account..."
          : isSignIn
            ? "Login"
            : "Sign up"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignIn ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Log in
            </button>
          </>
        )}
      </p>
    </form>
  )
}
