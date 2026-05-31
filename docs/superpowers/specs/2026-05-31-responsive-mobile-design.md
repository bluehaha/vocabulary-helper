# Responsive (Mobile) Web Design

## Goal

Make the search and upload-queue pages usable on a phone. The app currently
assumes a desktop viewport (~760px container, no viewport meta tag, table-based
queue), so on a phone it renders zoomed-out and the upload table overflows or
gets crushed.

## Scope

CSS-only changes plus a one-line `<meta viewport>` addition to each page. No
HTML structure changes, no JS changes, no new pages or features.

Out of scope: dark mode, hamburger nav, PWA install, offline behavior, swipe
gestures.

## Changes

### 1. Viewport meta tag

Add to `public/search.html` and `public/upload.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

Without this, mobile Safari/Chrome render at desktop width then scale down.

### 2. Container padding (narrow screens)

Below 640px, reduce `main` and `.topbar` horizontal padding from `1.25rem` to
`0.75rem` so content uses the full viewport width.

### 3. Search form wrap

Below ~420px, allow the `Look up` button to wrap onto its own line so the
input never gets squeezed below a usable width.

### 4. Upload queue table

Below 640px, hide the `Looked up` and `Preview` columns (both `<th>` and
`<td>`). Keep checkbox / word / status. Rationale: timestamps and previews are
the least critical info on a phone; the word and its status are what the user
acts on. If they need the preview, they can re-look the word up.

### 5. Touch targets

On narrow screens, bump checkbox size (~1.25rem) and row vertical padding so
tap targets are reliable. Stack the actions row buttons if they don't fit.

### 6. Single breakpoint

One breakpoint at `max-width: 640px` covers phones in portrait. Larger phones
in landscape and tablets fall back to the existing desktop layout, which
already fits.

## Non-goals

- No JavaScript changes.
- No alternate mobile-only layouts beyond what the table-collapse achieves.
- No dark mode or theme switching.
