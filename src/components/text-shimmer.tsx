"use client"

import { twMerge } from "tailwind-merge"

export type TextShimmerProps = {
  as?: string
  duration?: number
  spread?: number
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>

// Adapted from prompt-kit/text-shimmer — animated gradient mask over text
// to indicate an in-progress AI/LLM operation.
export function TextShimmer({
  as = "span",
  className,
  duration = 4,
  spread = 20,
  children,
  ...props
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45)
  const Component = as as React.ElementType

  return (
    <Component
      className={twMerge(
        "bg-clip-text font-medium text-transparent shimmer-anim",
        className,
      )}
      style={{
        backgroundSize: "200% auto",
        backgroundImage: `linear-gradient(to right, var(--color-muted-fg) ${50 - dynamicSpread}%, var(--color-fg) 50%, var(--color-muted-fg) ${50 + dynamicSpread}%)`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </Component>
  )
}
