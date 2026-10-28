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
- Fonts: set `--font-schibsted` and `--font-newsreader` on `<html>` with `next/font`. Until they
  load, `--font-ui` and `--font-reading` fall back to system grotesk and serif stacks.
- Theme: read the `theme` cookie on the server with `readThemeCookie()` and render
  `data-theme={themeAttribute(pref)}` on `<html>`. With no attribute the page follows
  `prefers-color-scheme`. `ThemeToggle` and the account menu write the cookie (one year, `Path=/`,
  `SameSite=Lax`) and update the attribute straight away, with no reload.
- Browser chrome colour: render the `<meta name="theme-color">` pair from the same cookie with
  `themeColors(pref)` (it has the shape of Next's `Viewport.themeColor`, so use it in
  `generateViewport`). "Match system" gives each `prefers-color-scheme` query its own `--mist`; a
  manual Light or Dark gives both queries that mode's colour. `setThemePreference` (used by
  `ThemeToggle` and the account menu) calls `applyThemeColor` to update the tags in place, and
  restores the media-based pair for "Match system". `THEME_COLORS` is checked against `--mist` in
  `contrast.test.ts`.
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

| Group              | Tokens                                                                                                                       | Tailwind                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Colour (§6.2)      | `--paper --mist --line --graphite --slate --ink --ink-soft --highlighter --record --verified --needs --risk`, plus `--scrim` | `bg-paper`, `text-slate`, `border-line`…                                                                  |
| Type (§6.3)        | 13/18, 16/24, 20/28, 25/32, 31.25/40, 39/48, 48.8/56; essay 18/30 and 19/32                                                  | `text-sm` `text-base` `text-lg` `text-xl` `text-2xl` `text-3xl` `text-4xl` `text-essay` `text-essay-wide` |
| Families           | `--font-ui` (Schibsted Grotesk), `--font-reading` (Newsreader)                                                               | `font-ui`, `font-reading`                                                                                 |
| Radius (§6.4)      | 6px controls, 10px panels and cards, full circle for the record button                                                       | `rounded-control`, `rounded-panel`, `rounded-full`                                                        |
| Shadow             | one soft shadow, for overlays only                                                                                           | `shadow-overlay`                                                                                          |
| Focus (§6.9)       | `--ink`, 2px ring, 2px offset (applied globally with `:focus-visible`)                                                       | —                                                                                                         |
| Motion (§6.6)      | 200ms highlight, 240ms drawer, 320ms lift, `--ease-calm`                                                                     | `animate-drawer-in/out`                                                                                   |
| Breakpoints (§6.9) | 640 / 1024 / 1280                                                                                                            | `sm:` `lg:` `xl:` (`md:` and `2xl:` are removed)                                                          |

Spacing uses Tailwind's 4px step. The `.tabular` class (or Tailwind's `tabular-nums`) lines up
figures in counts and tables.

## Rules the tokens depend on

`src/contrast.test.ts` checks these in both modes. It also fails if the two copies of the dark
palette (the system-preference copy and the `data-theme="dark"` copy) stop matching.

- **Text:** `graphite`, `slate`, `ink`, `verified`, `needs` and `risk` all reach 4.5:1 on `paper`
  and on `mist`.
- **Hover and selected backgrounds:** only `graphite`, `slate` or `ink` text goes on `ink-soft`.
  Status colours never do; in light mode they reach only about 4.1:1 there.
- **Primary and danger buttons:** the text is `--paper` in both modes. White on dark-mode `--ink`
  would be only 2.4:1.
- **`--record`** is for the record button only (fill and ring), never for text. In light mode it is
  3.9:1 on white.
- **Borders:** `--line` (1.3:1) is for decorative dividers and panel edges only. Inputs, secondary
  buttons and other form controls use a `--slate` border, which meets WCAG 1.4.11.
- **Highlighter:** only `graphite` text goes on `--highlighter`. When `prefers-contrast: more` or
  `forced-colors` is on, highlighted text also gets a 1px dotted underline.
- **Colour is never the only signal.** Statuses have an icon and a word. The current nav item has a
  filled background and bold text. The selected tab has an underline. Links are always underlined.
- **Text style:** sentence case everywhere. Nothing uses `uppercase` or letter-spaced labels, and
  text is never smaller than 13px.
- **Motion:** none on static surfaces, and no entrance animations. Drawers slide and scrims fade, and
  `prefers-reduced-motion` turns both off.
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
| `Drawer`, `DrawerContent`                        | Slides in from the right, 380px wide (full width on mobile).                                                                                                                                                                                                                                                              |
| `Tooltip`                                        | Extra information only; it is never a control's name.                                                                                                                                                                                                                                                                     |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Radix Tabs. Arrow keys move between tabs.                                                                                                                                                                                                                                                                                 |
| `ToastProvider`, `useToast`                      | The title names the action, using the same verb as the button ("Draft updated").                                                                                                                                                                                                                                          |
| `StatusLabel`                                    | Tones: `verified`, `needs`, `risk`, `neutral`. Always icon plus text.                                                                                                                                                                                                                                                     |
| `EmptyState`                                     | A headline, a short description and one action. Left-aligned by default; `align="center"` only when the description is one line (§6.4 allows no other centred text).                                                                                                                                                      |
| `SkipLink`, `VisuallyHidden`                     | Skip link reads "Skip to content" and targets `#main`.                                                                                                                                                                                                                                                                    |
| `ThemeToggle`                                    | A radio group: Match system, Light, Dark. Choosing one also updates the theme-color meta tags.                                                                                                                                                                                                                            |
| `AppShell`                                       | Left rail from 640px up; it scrolls when the window is shorter than its content (about 560px), so every destination and the account menu stay reachable. Below 640px: a top bar with search and account, and a bottom tab bar with the six destinations. The current page gets `aria-current="page"`. `<main id="main">`. |
| `NAV_ITEMS`                                      | Home, Story, Schools, Interview, Connect, Tracker.                                                                                                                                                                                                                                                                        |
| Command palette                                  | ⌘K or Ctrl K, or the search button. Keydowns without a `key` (Chrome sends them on autofill) are ignored. Lists the destinations plus any `actions` passed to `AppShell`. cmdk is lazy-loaded on first open and is not exported from the package.                                                                         |

Icons are Phosphor, regular weight, 20px in the UI and 16px inline. Client components import from
`@phosphor-icons/react`. Server-safe modules import from `@phosphor-icons/react/ssr`.
