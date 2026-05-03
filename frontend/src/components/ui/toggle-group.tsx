import { createContext, useContext } from "react"
import { cn } from "@/lib/utils"

interface ToggleGroupContextValue {
  value: string
  onValueChange: (value: string) => void
  size: "sm" | "default" | "lg"
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null)

function useToggleGroup() {
  const ctx = useContext(ToggleGroupContext)
  if (!ctx) throw new Error("ToggleGroupItem must be used inside <ToggleGroup>")
  return ctx
}

interface ToggleGroupProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  size?: "sm" | "default" | "lg"
  className?: string
  /** When true, items stretch to fill the container evenly. */
  stretch?: boolean
  ariaLabel?: string
}

export function ToggleGroup({
  value,
  onValueChange,
  children,
  size = "default",
  className,
  stretch = false,
  ariaLabel,
}: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider value={{ value, onValueChange, size }}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-1 rounded-3xl bg-muted p-1",
          stretch && "flex w-full",
          className,
        )}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}

interface ToggleGroupItemProps {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function ToggleGroupItem({
  value,
  children,
  className,
  disabled,
}: ToggleGroupItemProps) {
  const { value: current, onValueChange, size } = useToggleGroup()
  const active = current === value

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-state={active ? "on" : "off"}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-3xl text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-7 px-3 text-xs",
        size === "default" && "h-8 px-4",
        size === "lg" && "h-9 px-5",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}
