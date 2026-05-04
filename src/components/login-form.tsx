"use client"

import { useState } from "react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import { toast } from "sonner"

type Mode = "signin" | "signup"

function LField({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  return (
    <TextField value={value} onChange={onChange} isRequired type={type as any}>
      <Label>{label}</Label>
      <Input autoComplete={autoComplete} />
    </TextField>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const isSignIn = mode === "signin"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSignIn && password !== confirm) {
      toast.error("Passwords do not match")
      return
    }
    setSubmitting(true)
    try {
      const { error } = isSignIn
        ? await auth.signIn.email({ email, password })
        : await auth.signUp.email({ email, password, name })
      if (error) toast.error(error.message ?? "Authentication failed")
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-1 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {isSignIn ? "Login to your account" : "Create an account"}
        </h1>
        <p className="text-sm text-muted-fg">
          {isSignIn
            ? "Enter your email and password below"
            : "Enter your details to sign up"}
        </p>
      </div>
      {!isSignIn && (
        <LField
          label="Name"
          autoComplete="name"
          value={name}
          onChange={setName}
        />
      )}
      <LField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <LField
        label="Password"
        type="password"
        autoComplete={isSignIn ? "current-password" : "new-password"}
        value={password}
        onChange={setPassword}
      />
      {!isSignIn && (
        <LField
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
      )}
      <Button type="submit" isPending={submitting} className="mt-2">
        {isSignIn ? "Login" : "Sign up"}
      </Button>
      <p className="text-center text-sm text-muted-fg">
        {isSignIn ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          className="underline underline-offset-4 hover:text-fg"
          onClick={() => setMode(isSignIn ? "signup" : "signin")}
        >
          {isSignIn ? "Sign up" : "Log in"}
        </button>
      </p>
    </form>
  )
}
