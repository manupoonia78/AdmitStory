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
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  type SheetContentProps,
} from "./components/sheet";
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
export { ImmersiveScope, type ImmersiveScopeProps } from "./components/immersive-scope";
export {
  DARK_SCHEME_MEDIA,
  LIGHT_SCHEME_MEDIA,
  THEME_COLORS,
  THEME_COOKIE,
  THEME_LABELS,
  THEME_PREFERENCES,
  immersiveTheme,
  parseThemePreference,
  readThemeCookie,
  serializeThemeCookie,
  themeAttribute,
  themeColors,
  type ThemeColorTag,
  type ThemeName,
  type ThemePreference,
} from "./theme-preference";

// Motion vocabulary and the applicant's hue (spec §6.6, §6.2–6.3).
export {
  MOTION_TOKENS,
  REDUCED_FADE,
  SPRINGS,
  cssSpring,
  spring,
  useMotionToken,
  type CssSpring,
  type MotionToken,
} from "./motion";
export { VOICE_HUES, voiceHueAt, voiceHueStyle, type VoiceHue } from "./voice-hues";
export {
  createFrameMonitor,
  type FrameMonitor,
  type FrameMonitorOptions,
  type FrameSnapshot,
} from "./lib/frame-monitor";

// AppShell renders the dock icons on the server; import it from server components only.
export { AppShell, type AppShellProps } from "./shell/app-shell";
export { AccountMenu, type AccountMenuProps, type AccountUser } from "./shell/account-menu";
export { NAV_ITEMS, isActivePath, type NavId, type NavItem } from "./shell/nav-items";
export { NAV_ICONS } from "./shell/nav-icons";
export { PALETTE_LABEL, type CommandAction } from "./shell/types";
export { preloadCommandPalette } from "./shell/command-palette-host";
export {
  ROUTE_TRANSITION_TYPE,
  RouteTransition,
  viewTransitionsSupported,
  type RouteTransitionProps,
} from "./shell/route-transition";
export {
  SharedElement,
  flipFrom,
  type Flip,
  type SharedElementProps,
} from "./shell/shared-element";
export { VIEW_TRANSITION_CSS, ViewTransitionStyles } from "./shell/view-transition-styles";

// Cursor craft (spec §6.6): magnetic primary actions and the edge light on planes.
export { MAGNETIC_MAX_PX, magneticOffset, mergeRefs, useMagnetic } from "./lib/magnetic";
export { EdgeLight, edgeLightPoint, useEdgeLight } from "./lib/edge-light";

// Phase 0.5 areas, each owned by one agent (see the comment in each barrel).
export * from "./voiceprint";
export * from "./studio";
export * from "./interview";
export * from "./kit";
export * from "./workspace";
export * from "./dossier";
// Phase 3 areas (docs/design/phase-3-4-direction.md).
export * from "./profile";
export * from "./strategy";
