import * as React from "react"
import { DollarSign } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = Omit<React.ComponentProps<typeof Input>, "type"> & {
  className?: string
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ className, placeholder = "0.00", ...props }, ref) => (
    <div className="relative">
      <DollarSign className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        ref={ref}
        type="number"
        min="0"
        step="0.01"
        placeholder={placeholder}
        className={cn("pl-9", className)}
        {...props}
      />
    </div>
  ),
)
CurrencyInput.displayName = "CurrencyInput"
