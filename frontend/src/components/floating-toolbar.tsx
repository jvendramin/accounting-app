import { cn } from "@/lib/utils"

interface FloatingToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean
}

/**
 * A bottom-center floating action bar.
 * Shows above the page (z-50) and animates in/out via `open`.
 * Children should be the action buttons / labels themselves; styling of the
 * pill container is handled here.
 */
export function FloatingToolbar({
  open,
  className,
  children,
  ...props
}: FloatingToolbarProps) {
  return (
    <div
      data-state={open ? "open" : "closed"}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4",
        "transition-all duration-200 ease-out",
        open
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0",
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80",
          className,
        )}
        role="toolbar"
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

/** Visual divider for splitting toolbar groups. */
export function FloatingToolbarSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={cn("mx-1 h-5 w-px bg-border", className)}
    />
  )
}
