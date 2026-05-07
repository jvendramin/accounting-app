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

// Solid plus reads as a heavier "+" stroke than the 1.5px outline variant —
// preferred for primary CTAs (e.g. "+ New", "+ Add line", "+ Upload").
export { PlusIcon as IconPlus } from "@heroicons/react/20/solid"
