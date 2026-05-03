import { useEffect, useState } from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  DateSelector,
  formatDateValue,
  type DateSelectorProps,
  type DateSelectorValue,
} from "@/components/reui/date-selector"
import { cn } from "@/lib/utils"

interface DateSelectorPopoverProps
  extends Omit<DateSelectorProps, "value" | "onChange" | "className"> {
  value: DateSelectorValue | undefined
  onChange: (value: DateSelectorValue | undefined) => void
  placeholder?: string
  triggerClassName?: string
  align?: "start" | "center" | "end"
}

export function DateSelectorPopover({
  value,
  onChange,
  placeholder = "Select a date",
  triggerClassName,
  align = "start",
  ...rest
}: DateSelectorPopoverProps) {
  const [open, setOpen] = useState(false)
  const [internal, setInternal] = useState<DateSelectorValue | undefined>(value)

  useEffect(() => {
    if (open) setInternal(value)
  }, [open, value])

  const formatted = value ? formatDateValue(value) : ""
  const display = formatted || placeholder

  const handleApply = () => {
    onChange(internal)
    setOpen(false)
  }

  const handleCancel = () => {
    setInternal(value)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-56 items-center justify-start gap-1.5 rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-sm whitespace-nowrap outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">{display}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto gap-3 p-0"
        align={align}
        sideOffset={4}
      >
        <div className="p-3">
          <DateSelector
            value={internal}
            onChange={setInternal}
            {...rest}
          />
        </div>
        <Separator />
        <div className="flex justify-end gap-2 p-3 pt-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
