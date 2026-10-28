// Public API of @admitstory/ui. CSS lives at "@admitstory/ui/theme.css" (with Tailwind)
// and "@admitstory/ui/tokens.css" (tokens only).
// The cmdk palette itself is deliberately not exported: it loads lazily inside AppShell.

export { cx } from "./lib/cx";

export { Button, type ButtonProps } from "./components/button";
export { buttonStyles, type ButtonSize, type ButtonVariant } from "./components/button-styles";
export { IconButton, type IconButtonProps } from "./components/icon-button";
export { TextLink, type TextLinkProps } from "./components/text-link";
export {
  TextField,
  Label,
  FieldHint,
  FieldError,
  FieldErrorRegion,
  type FieldErrorRegionProps,
  type TextFieldProps,
} from "./components/text-field";
export { focusFirstInvalid } from "./lib/focus-first-invalid";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  type DialogContentProps,
} from "./components/dialog";
export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  type DrawerContentProps,
} from "./components/drawer";
export { Tooltip, type TooltipProps } from "./components/tooltip";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";
export { ToastProvider, useToast, type ToastOptions } from "./components/toast";
export { StatusLabel, type StatusLabelProps, type StatusTone } from "./components/status-label";
export { SkipLink, type SkipLinkProps } from "./components/skip-link";
export { VisuallyHidden } from "./components/visually-hidden";
export { EmptyState, type EmptyStateAlign, type EmptyStateProps } from "./components/empty-state";
export {
  ThemeToggle,
  setThemePreference,
  useThemePreference,
  type ThemeToggleProps,
} from "./components/theme-toggle";
export { applyThemeColor } from "./components/theme-store";
export {
  DARK_SCHEME_MEDIA,
  LIGHT_SCHEME_MEDIA,
  THEME_COLORS,
  THEME_COOKIE,
  THEME_LABELS,
  THEME_PREFERENCES,
  parseThemePreference,
  readThemeCookie,
  serializeThemeCookie,
  themeAttribute,
  themeColors,
  type ThemeColorTag,
  type ThemePreference,
} from "./theme-preference";

export { AppShell, type AppShellProps } from "./shell/app-shell";
export { AccountMenu, type AccountMenuProps, type AccountUser } from "./shell/account-menu";
export { NAV_ITEMS, isActivePath, type NavItem } from "./shell/nav-items";
export { PALETTE_LABEL, type CommandAction } from "./shell/types";
export { preloadCommandPalette } from "./shell/command-palette-host";
