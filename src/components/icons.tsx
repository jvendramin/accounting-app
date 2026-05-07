// Centralised icon imports — heroicons by default per Intent UI starter,
// renamed to "Icon*" for clarity at call-sites.
export {
  HomeIcon as IconHome,
  ArrowsRightLeftIcon as IconArrowLeftRight,
  BookOpenIcon as IconBookOpen,
  ReceiptPercentIcon as IconReceipt,
  ArrowUpTrayIcon as IconUpload,
  ChartBarIcon as IconChartBar,
  ScaleIcon as IconCircleQuestionmark,
  WalletIcon as IconWallet,
  ArrowRightOnRectangleIcon as IconLogout,
  PencilSquareIcon as IconPencil,
  TrashIcon as IconTrash,
  MagnifyingGlassIcon as IconSearch,
  XMarkIcon as IconX,
  TagIcon as IconTag,
  ClockIcon as IconActivity,
  CalculatorIcon as IconTax,
} from "@heroicons/react/24/outline"

// Heavier "+" glyph for primary CTAs — heroicons' outline and solid
// variants both render thin against vivid fills, so use a hand-rolled
// SVG with stroke-width 3.
export function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-slot="icon"
      {...props}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
