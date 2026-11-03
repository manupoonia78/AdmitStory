// The Phase 0 name for Sheet (spec §6.8 calls it Sheet). Kept as an alias so existing imports keep
// working; new code should import Sheet.

export {
  Sheet as Drawer,
  SheetTrigger as DrawerTrigger,
  SheetClose as DrawerClose,
  SheetContent as DrawerContent,
  type SheetContentProps as DrawerContentProps,
} from "./sheet";
