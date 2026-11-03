# @admitstory/ui

The design system: tokens, Tailwind theme, base components and the signed-in app shell
(spec §6). The product name comes only from `APP_NAME` in `@admitstory/shared`.

## Using it

```css
/* apps/web/app/globals.css */
@import "tailwindcss";
@import "@admitstory/ui/theme.css";
```

- `theme.css` imports `tokens.css`, clears Tailwind's default palette, fonts, type scale, radii
  and shadows, and maps the tokens into utilities. It also tells Tailwind to scan this package.
- Fonts: set `--font-geist-sans` (`GeistSans.variable` from `geist/font/sans`) and
  `--font-newsreader` (`next/font/google`) on `<html>`. Until they load, `--font-ui` and
  `--font-reading` fall back to system sans and serif stacks.
- Theme: read the `theme` cookie on the server with `readThemeCookie()` and render
  `data-theme={themeAttribute(pref)}` on `<html>`. With no attribute the page follows
  `prefers-color-scheme`. `ThemeToggle` and the account menu write the cookie (one year, `Path=/`,
  `SameSite=Lax`) and update the attribute straight away, with no reload.
- Browser chrome colour: render the `<meta name="theme-color">` pair from the same cookie with
  `themeColors(pref)` (it has the shape of Next's `Viewport.themeColor`, so use it in
  `generateViewport`). "Match system" gives each `prefers-color-scheme` query its own `--space`; a
  manual Night or Day gives both queries that theme's colour; `{ immersive: true }` gives Night
  unless Day was chosen. `setThemePreference` (used by
  `ThemeToggle` and the account menu) calls `applyThemeColor` to update the tags in place, and
  restores the media-based pair for "Match system". `THEME_COLORS` is checked against `--space` in
  `contrast.test.ts`. Phase 0 cookies (`light`, `dark`) still parse, as Day and Night.
- Immersive screens (Story Studio, kit generation, live mocks, prototypes): wrap them in
  `<ImmersiveScope serverValue={pref}>`. Its subtree is Night unless the user chose Day, and it
  paints its own `--space` and film grain.
- The applicant's hue: put `style={voiceHueStyle(index)}` on any ancestor; `--voice` and
  `--voice-glow` resolve for whichever theme each element is in. Only the applicant's Voiceprint and
  own-word glow use it; chrome never does.
- Motion: Motion transitions come from `spring(token)` / `useMotionToken(token)` in `motion.ts`
  (`snap`, `glide`, `drift`, `settle`); CSS uses `var(--spring-<token>)` with
  `var(--spring-<token>-duration)` (or `ease-<token>` in Tailwind). Nothing else.
- Toasts: wrap the app in `<ToastProvider>` and call `useToast().toast({ title })`.
- Form errors (WCAG 3.3.1, 4.1.3): `TextField` puts its error in `FieldErrorRegion`, a polite live
  region that is always in the DOM, so an error is announced when it appears. Use
  `<FieldErrorRegion id={errorId} error={error} />` for hand-built fields (checkboxes) rather than a
  bare `FieldError`, and point the control's `aria-describedby` at `errorId`. After a failed submit
  of a form with more than one field, call `focusFirstInvalid(formRef.current)` once the errors
  have rendered (in an effect on the error state, or after `flushSync`, not in the submit handler):
  it focuses the first `aria-invalid="true"` field, skipping disabled and hidden ones, and the
  screen reader reads its label and error. Some screen readers then repeat the error from the live
  region; that is the accepted cost of not missing it.

## Tokens (`src/tokens.css`)

| Group               | Tokens                                                                                                                                             | Tailwind                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Colour (§6.3)       | `--space --depth --veil --edge --text --text-soft --signal --record --verified --needs --risk`, plus `--on-signal --control-edge --silver --scrim` | `bg-space`, `bg-depth`, `text-text-soft`, `border-edge`, `border-control`…      |
| Voice (§6.2)        | `--voice`, `--voice-glow` (from `--voice-night` / `--voice-day`, set by `voiceHueStyle`)                                                           | `text-voice`, `bg-voice`, `bg-voice-glow`                                       |
| Type (§6.4)         | UI 13 / 15 / 17; reading 19 / 21 (essays 19/32, 66ch); display 40 / 64 / 96 / 144, fluid with `clamp()`, weight 600, −0.04em, leading 0.95         | `text-sm` `text-base` `text-lg` `text-read` `text-read-lg` `text-display-sm…xl` |
| Families            | `--font-ui` (Geist), `--font-reading` (Newsreader)                                                                                                 | `font-ui`, `font-reading`                                                       |
| Radius (§6.5)       | 8px controls, 16px planes, 28px full-screen sheets, circle for the record button and the Voiceprint                                                | `rounded-control`, `rounded-plane`, `rounded-sheet`, `rounded-full`             |
| Planes and shadow   | Night planes get a 1px inner edge light (`--plane-light`), never a drop shadow; overlays keep one soft shadow                                      | `plane`, `shadow-plane`, `shadow-overlay`                                       |
| Film grain (§6.3)   | Static SVG noise at 2% over Night backgrounds (`--grain`; `none` in Day)                                                                           | `grain` (on `body` and theme scopes already)                                    |
| Focus (§6.12)       | `--signal`, 2px ring, 2px offset (applied globally with `:focus-visible`)                                                                          | —                                                                               |
| Motion (§6.6)       | `--spring-snap/glide/drift/settle` (`linear()` easings) and `--spring-*-duration`; 120ms linear under reduced motion                               | `ease-snap`… `animate-sheet-in/out` `animate-fade-in/out`                       |
| Breakpoints (§6.12) | 640 / 1024 / 1280                                                                                                                                  | `sm:` `lg:` `xl:` (`md:` and `2xl:` are removed)                                |

Spacing uses Tailwind's 4px step. The `.tabular` class (or Tailwind's `tabular-nums`) lines up
figures in counts and tables.

## Rules the tokens depend on

`src/contrast.test.ts` checks these in both themes, and `src/voice-hues.test.ts` checks the 12
hues. It also fails if the two copies of the Night palette (the system-preference copy and the
`data-theme="night"` copy) stop matching.

- **Text:** `text`, `text-soft`, `signal`, `silver`, `verified`, `needs` and `risk` all reach 4.5:1
  on `space` and on `depth`. Every Voiceprint hue reaches 4.5:1 on its theme's `space` and `depth`
  (duet captions are set in it), and `text` reaches 4.5:1 on every `--voice-glow`.
- **Hover and selected backgrounds:** only `text`, `text-soft` or `signal` goes on `veil`. Status
  colours never do; in Day they reach only about 4.2:1 there.
- **Primary and danger buttons:** the text is `--on-signal` (white in Day, `--space` in Night).
  White on Night `--signal` would be 1.8:1.
- **`--record`** is for the record button only (fill and ring), never for text. In Day it is
  4.4:1 on `--space`.
- **Borders:** `--edge` is for decorative dividers and plane edges only. Inputs, secondary buttons
  and other form controls use `--control-edge` (`border-control`), which meets WCAG 1.4.11.
- **Own-word glow:** `<mark>` is `--voice-glow` with `text` on it. When `prefers-contrast: more` or
  `forced-colors` is on, it also gets a 1px dotted underline.
- **Colour is never the only signal.** Statuses have an icon and a word. The current nav item has a
  filled background and bold text. The selected tab has an underline. Links are always underlined.
- **Text style:** sentence case everywhere. Nothing uses `uppercase` or letter-spaced labels, and
  text is never smaller than 13px.
- **Motion:** only the four springs. Every animation is interruptible. Under
  `prefers-reduced-motion` springs become 120ms opacity fades: drawers fade instead of sliding.
- **Touch targets:** at least 44px. Small (`sm`) buttons are 36px to look at, with a 44px hit area.

## Components

| Component                                        | Notes                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                         | Variants: `primary`, `secondary`, `quiet`, `danger`. Sizes: `md`, `sm`. `loading` sets `aria-busy` and ignores clicks without losing focus. `asChild` styles a link. `icon` takes a leading Phosphor icon.                                                                                                                |
| `IconButton`                                     | `aria-label` is required. Renders a 20px Phosphor icon. Works in server components when given an icon from `@phosphor-icons/react/ssr`.                                                                                                                                                                                   |
| `buttonStyles()`                                 | The button classes as a function you can call on the server.                                                                                                                                                                                                                                                              |
| `TextLink`                                       | A `next/link`, always underlined. `external` opens a new tab and tells screen readers.                                                                                                                                                                                                                                    |
| `TextField`, `Label`, `FieldHint`, `FieldError`  | Hint and error are linked to the input with `aria-describedby`. An error sets `aria-invalid` and is announced through `FieldErrorRegion`.                                                                                                                                                                                 |
| `FieldErrorRegion`, `focusFirstInvalid()`        | An always-present polite live region for a field's error, and the helper that focuses the first invalid field after a failed submit. See "Form errors" above.                                                                                                                                                             |
| `Dialog`, `DialogContent`                        | Radix Dialog. A title is required. Has a close button and one overlay shadow.                                                                                                                                                                                                                                             |
| `Drawer`, `DrawerContent`                        | Glides in from the right, 400px wide (full width on mobile).                                                                                                                                                                                                                                                              |
| `Tooltip`                                        | Extra information only; it is never a control's name.                                                                                                                                                                                                                                                                     |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix Tabs. Arrow keys move between tabs.                                                                                                                                                                                                                                                                                 |
| `ToastProvider`, `useToast`                      | The title names the action, using the same verb as the button ("Draft updated").                                                                                                                                                                                                                                          |
| `StatusLabel`                                    | Tones: `verified`, `needs`, `risk`, `neutral`. Always icon plus text.                                                                                                                                                                                                                                                     |
| `EmptyState`                                     | A headline, a short description and one action. Left-aligned by default; `align="center"` only when the description is one line (§6.4 allows no other centred text).                                                                                                                                                      |
| `SkipLink`, `VisuallyHidden`                     | Skip link reads "Skip to content" and targets `#main`.                                                                                                                                                                                                                                                                    |
| `ThemeToggle`                                    | A radio group: Match system, Night, Day. Arrow keys move and choose, Home and End jump to the ends. Written out rather than taken from Radix, so it costs no first-load budget on the routes that render it (spec §6.11). Choosing one also updates the theme-color meta tags.                                            |
| `AppShell`                                       | Left rail from 640px up; it scrolls when the window is shorter than its content (about 560px), so every destination and the account menu stay reachable. Below 640px: a top bar with search and account, and a bottom tab bar with the six destinations. The current page gets `aria-current="page"`. `<main id="main">`. |
| `NAV_ITEMS`                                      | Home, Story, Schools, Interview, Connect, Tracker.                                                                                                                                                                                                                                                                        |
| Command palette                                  | ⌘K or Ctrl K, or the search button. Keydowns without a `key` (Chrome sends them on autofill) are ignored. Lists the destinations plus any `actions` passed to `AppShell`. cmdk is lazy-loaded on first open and is not exported from the package.                                                                         |

Icons are Phosphor, regular weight, 20px in the UI and 16px inline. Client components import from
`@phosphor-icons/react`. Server-safe modules import from `@phosphor-icons/react/ssr`.
