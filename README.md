# Lightbox

A themeable, localisable image lightbox with a framework-free core. Use it from
plain JavaScript on any site (including framework-free Astro sites), or through
the bundled React `<Gallery>` component.

- **No framework required** — the overlay is plain DOM and CSS
  (`createLightbox()`). React is an optional wrapper, not a dependency.
- **Multiple galleries per page** — each gallery is fully self-contained.
- **Light / dark / auto theming** via CSS custom properties.
- **Titles, descriptions and alt text per image**, each either a plain string or a
  locale map (`{ en: 'River', ja: '川' }`). UI strings are built in for English
  and Japanese. Add other locales through the `uiStrings` prop.
- **Responsive images** — every image lists its available resolutions, and the
  component emits `srcset`/`sizes` for both thumbnails and the full-size view.
- **Six open/close transitions**: `pop`, `fade`, `slide` (in from a screen
  edge, out through another), `spin` (tumbles in from an edge or corner,
  rotating as it travels), `roll` (unrolls like a carpet from one edge and
  rolls back up on close) and `draw` (the image appears as tiles in a
  configurable order and style). Falls back to a plain fade when the user
  prefers reduced motion.
- **Desktop and mobile**: keyboard navigation (arrows, Escape, focus trap),
  touch swipe left/right to navigate and down to close, safe-area insets.
- **Opens from the thumbnail**: give `open()` the clicked element and the `pop`
  transition grows the image out of it.

## Installing

The package is installed straight from GitHub. `npm` builds it on install
through the `prepare` script.

```sh
npm install github:TokyoDanInJapan/lightbox#v1.0.0
```

Entry points:

- `lightbox/core` — the framework-free API (no React in your bundle).
- `lightbox` — the above plus the React `<Gallery>` component.
- `lightbox/styles.css` — the stylesheet, required by both.

## Layout

- `src/` — the library. `src/core/` is framework-free; `src/react/` is the
  optional wrapper.
- `demo/` — an Astro site exercising every feature: a React page at `/` and a
  no-React page at `/vanilla`.

## Running the demo

```sh
npm install
npm run dev        # installs the demo's dependencies, then starts Astro
```

## Tests

```sh
npm run test:unit   # Vitest: pure logic and the core overlay in happy-dom
npm run test:e2e    # Playwright: both demo pages in Chromium
npm test            # both
```

The browser tests build the demo and serve it with `astro preview`
automatically. CI runs the full suite on every push and pull request.

## The image shape

Both APIs take the same data:

```ts
import type { GalleryImage } from 'lightbox/core'

const images: GalleryImage[] = [
  {
    sources: [
      { src: '/photos/river-480.jpg', width: 480 },
      { src: '/photos/river-960.jpg', width: 960 },
      { src: '/photos/river-1920.jpg', width: 1920 },
    ],
    width: 1920,
    height: 1280,
    title: { en: 'River valley', ja: '渓谷の川' },
    description: { en: 'Early morning on the river.', ja: '早朝の川。' },
    alt: { en: 'A river in a forested valley', ja: '森の谷を流れる川' },
  },
]
```

## Usage without a framework

Render your own thumbnails however you like (server-side, with your site's
image pipeline), then attach the core:

```ts
import 'lightbox/styles.css'
import { createLightbox } from 'lightbox/core'

const section = document.querySelector('#my-gallery')
const lightbox = createLightbox({
  images,
  locale: 'en',
  theme: 'auto',
  transition: 'pop',
  container: section,   // optional: enables the gallery:open event seam
})

section.querySelectorAll('.my-thumb').forEach((button, index) => {
  button.addEventListener('click', () => lightbox.open(index, button))
})
```

The controller API:

| Method | Behaviour |
| --- | --- |
| `open(index, trigger?)` | Open at an image. With a `trigger` element, `pop` grows out of its on-screen position. |
| `close()` | Play the closing animation, then remove the overlay. |
| `next()` / `prev()` | Navigate. |
| `setLocale(locale)` | Switch language; live captions and labels re-render. |
| `destroy()` | Remove all listeners and any open overlay immediately. |

When `container` is set, the controller also listens for a CustomEvent, so
other components can open the gallery without knowing its markup:

```ts
section.dispatchEvent(new CustomEvent('gallery:open', { detail: { index: 2 } }))
```

### With Astro's image pipeline

Build `sources` at compile time from optimised assets, then feed the script:

```astro
---
import { getImage } from 'astro:assets'

const sources = await Promise.all(
  [480, 960, 1920].map(async (width) => ({
    src: (await getImage({ src: original, width })).src,
    width,
  })),
)
---
```

The demo's `/vanilla` page shows the full pattern with server-rendered
thumbnails and two independent galleries.

## Usage with React

```tsx
import { Gallery } from 'lightbox'
import 'lightbox/styles.css'

<Gallery images={images} locale="ja" theme="auto" transition="draw" />
```

In an Astro page with the React integration, mount it as an island:

```astro
---
import { Gallery } from 'lightbox'
---
<Gallery images={images} locale="en" client:load />
```

React is an optional peer dependency: sites that only import `lightbox/core`
never load it.

### `<Gallery>` props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `images` | `GalleryImage[]` | — | See shape above. |
| `locale` | `string` | `'en'` | Selects caption text and UI strings. |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | `auto` follows `prefers-color-scheme`. |
| `transition` | `TransitionSetting` | `'pop'` | Open/close animation: a kind or a config object (see below). |
| `thumbnailSizes` | `string` | `'(max-width: 600px) 45vw, 240px'` | `sizes` attribute for thumbnails. |
| `uiStrings` | `Partial<Record<string, Partial<UIStrings>>>` | — | Add or override chrome labels per locale. |
| `className` | `string` | — | Extra class on the gallery root. |

### Configuring transitions

`transition` accepts either a kind — `'pop' | 'fade' | 'slide' | 'draw' |
'spin' | 'roll'` — or a config object:

```tsx
<Gallery images={images} transition={{ kind: 'draw', duration: 1500, cols: 8, rows: 6 }} />
```

| Field | Applies to | Default | Meaning |
| --- | --- | --- | --- |
| `kind` | — | — | Which animation to use. |
| `duration` | all | pop 300 / fade 260 / slide 440 / draw 760 / spin 600 / roll 700 | Total open/close time in ms. For `draw`, the time until the last tile has finished appearing. |
| `cols` | draw | 5 | Number of tile columns. |
| `rows` | draw | 4 | Number of tile rows. |
| `tileDuration` | draw | 260 | Fade time of one tile in ms. The gap between tiles is derived from `duration`, `tileDuration` and the tile count. |
| `tileEffect` | draw | `'fade'` | How each tile arrives: `'fade'`, `'pop'` (scales up into place), `'slide'` (enters from `slideFrom`, leaves via `slideTo`) or `'spin'` (as slide, but rotating). |
| `tileOrder` | draw | `'random'` | Order tiles appear in: `'random'` (shuffled, re-shuffled on close), `'sequential'` (top-left to bottom-right in reading order), `'snake'` (reverses direction on every other row) or `'diagonal'` (anti-diagonal bands sweeping from the top-left corner to the bottom-right). |
| `slideFrom` | slide, spin, roll, draw+slide/spin tiles | `'top'` | Screen edge or corner the image (or each tile) travels in from: `'top' \| 'bottom' \| 'left' \| 'right' \| 'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right' \| 'random'`. With `'random'`, slide/spin/roll pick one per open and draw picks one per tile. Tiles travel from the actual viewport edge, not just outside their own cell. |
| `slideTo` | slide, spin, draw+slide/spin tiles | `'bottom'` | As `slideFrom`, but the edge it leaves through on close. Ignored by `roll`. |

The `spin` transition rotates the image one full turn as it travels, with the
spin direction matching the motion (entering from the left turns clockwise,
from the right counter-clockwise).

The `roll` transition unrolls the image like a carpet from its `slideFrom`
edge — a soft roller shadow tracks the unroll front — and always rolls back
up towards that same edge on close. Corners coerce to `top`/`bottom`.

When the user has `prefers-reduced-motion` set, every transition collapses to a
default-speed fade regardless of configuration.

### Adding a locale

```tsx
<Gallery
  images={images}
  locale="fr"
  uiStrings={{
    fr: {
      dialogLabel: "Visionneuse d'images",
      close: 'Fermer',
      next: 'Image suivante',
      previous: 'Image précédente',
      counter: 'Image {current} sur {total}',
    },
  }}
/>
```

Unknown locales fall back to English for UI strings. Localised image text falls
back to `en`, then to the first available value.

### Theming

All colours are CSS custom properties scoped to `[data-lb-theme]` in
`styles.css` — override them in your own stylesheet to match your site:

```css
[data-lb-theme='dark'] {
  --lb-backdrop: rgba(0, 0, 0, 0.97);
  --lb-focus: #f97316;
}
```

## Releasing

Bump `version` in `package.json`, commit, then tag and push:

```sh
git tag v0.x.y && git push --tags
```

Consumers pin the tag in their dependency specifier
(`github:TokyoDanInJapan/lightbox#v0.x.y`). The build runs on the consumer's
machine at install time, so no artefacts are committed.

## Licence

[MIT](LICENSE)
