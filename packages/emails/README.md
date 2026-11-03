# @admitstory/emails

Transactional email templates, built with React Email (spec §7.1). Sending lives in
`apps/web/lib/email.ts`; this package only renders.

```ts
import { renderMagicLinkEmail } from "@admitstory/emails";

const { subject, html, text } = await renderMagicLinkEmail({ url, expiresInMinutes: 10 });
```

| Template         | Notes                                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MagicLinkEmail` | The sign-in link as a button and as a plain link, how long it works, and "If you didn't ask to sign in, you can ignore this email." Light colours from the UI tokens, inlined (email clients ignore CSS variables). |

Every template returns an HTML body and a plain-text alternative built from the same copy, sets
`lang`, uses one `h1`, and marks layout tables as presentation. Copy follows spec §6.7: plain,
warm, direct, sentence case, no exclamation marks. The product name comes only from `APP_NAME`.

`renderMagicLinkEmail` accepts absolute http(s) URLs only and expiries of 1 to 1440 minutes.
