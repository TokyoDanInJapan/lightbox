import { fileURLToPath } from 'node:url'
import { test as base, expect, type Page } from '@playwright/test'

const photo = fileURLToPath(new URL('./fixtures/photo.jpg', import.meta.url))

// The demo's pictures come from picsum.photos. Serve a local one in their
// place, so the suite neither depends on that site nor waits on it.
// biome-ignore lint/suspicious/noConfusingVoidType: Playwright's idiom for a fixture with no value
const test = base.extend<{ localPhotos: void }>({
  localPhotos: [
    async ({ page }, use) => {
      await page.route('https://picsum.photos/**', (route) =>
        route.fulfill({ path: photo, contentType: 'image/jpeg' }),
      )
      await use()
    },
    { auto: true },
  ],
})

const openOverlay = (page: Page) => page.locator('.lb-overlay')

/**
 * Wait for the stage to stop animating. The class changes when the animation
 * starts, so a box measured straight after is still scaled. A transition that
 * is cancelled or retargeted rejects `finished`, so wait until none are left
 * rather than for the first set to resolve.
 */
const settled = (page: Page) =>
  page.locator('.lb-stage').evaluate(async (stage) => {
    for (let running = stage.getAnimations(); running.length; running = stage.getAnimations()) {
      await Promise.allSettled(running.map((a) => a.finished))
    }
  })

test.describe('React demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    // Astro removes the ssr attribute once the island has hydrated; interacting
    // before that changes the native controls without React noticing.
    await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' })
  })

  test('opens, navigates and closes with the keyboard', async ({ page }) => {
    await page.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay).toHaveClass(/is-open/)
    await expect(overlay.locator('.lb-counter')).toHaveText('Image 1 of 6')
    await expect(overlay.locator('.lb-title')).toHaveText('River valley')

    await page.keyboard.press('ArrowRight')
    await expect(overlay.locator('.lb-counter')).toHaveText('Image 2 of 6')
    await expect(overlay.locator('.lb-title')).toHaveText('Canyon walls')

    await page.keyboard.press('Escape')
    await expect(overlay).toHaveCount(0)
  })

  test('two galleries are independent', async ({ page }) => {
    const secondGallery = page.locator('.lb-gallery').nth(1)
    await secondGallery.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay.locator('.lb-counter')).toHaveText('Image 1 of 4')
    await expect(overlay.locator('.lb-title')).toHaveText('Old castle')
  })

  test('renders Japanese captions and counter', async ({ page }) => {
    await page.getByLabel('Language').selectOption('ja')
    await page.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay.locator('.lb-counter')).toHaveText('6枚中1枚目')
    await expect(overlay.locator('.lb-title')).toHaveText('渓谷の川')
  })

  test('draw transition builds the configured tile grid', async ({ page }) => {
    await page.getByLabel('Transition').selectOption('draw')
    await page.getByLabel('Columns').fill('3')
    await page.getByLabel('Rows').fill('2')
    await page.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay.locator('.lb-tile')).toHaveCount(6)
    // After the reveal settles, the seamless copy is layered on top.
    await expect(overlay.locator('.lb-draw-full')).toHaveCount(1)
  })

  test('a tile that is travelling can be seen travelling', async ({ page }) => {
    // Opacity and the transform used to share one duration, so a tile faded in
    // over the whole of its journey: it crossed the viewport at almost no
    // opacity and only appeared once it had arrived. Twenty tiles doing that
    // reads as the picture popping into place, not sliding in.
    await page.getByLabel('Transition').selectOption('draw')
    await page.getByLabel('Tile effect').selectOption('slide')
    await page.getByLabel('Slide in from').selectOption('random')

    // Measured as the furthest from home a tile ever gets while fully visible.
    // Sharing one duration put that at 168px of a ~1440px journey, so the tile
    // only appeared once it was all but parked; over the first third it is
    // 1152px, which is most of the way.
    await page.evaluate(() => {
      ;(window as unknown as { __far: number }).__far = 0
      const sample = () => {
        for (const tile of document.querySelectorAll('.lb-tile')) {
          const style = getComputedStyle(tile)
          const at = new DOMMatrixReadOnly(style.transform)
          const away = Math.hypot(at.m41, at.m42)
          if (
            Number(style.opacity) >= 0.9 &&
            away > (window as unknown as { __far: number }).__far
          ) {
            ;(window as unknown as { __far: number }).__far = away
          }
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })

    await page.locator('.lb-thumb').first().click()
    // The seamless copy lands once the last tile has arrived.
    await page.waitForSelector('.lb-draw-full', { state: 'attached' })

    const far = await page.evaluate(() => (window as unknown as { __far: number }).__far)
    expect(far).toBeGreaterThan(400)
  })

  test('tiles survive a host stylesheet that clamps images', async ({ page }) => {
    // Nearly every reset carries `img { max-width: 100% }` - Tailwind's
    // preflight, normalize.css and the rest. A tile's image is deliberately
    // wider than its tile, so a clamp squeezes the whole picture into one of
    // them: every tile past the first column then offsets that narrow image
    // clean out of view and draws nothing, and the picture arrives in one go
    // when the seamless copy lands. It looked like the transition was broken.
    await page.addStyleTag({ content: 'img, video { max-width: 100%; height: auto; }' })
    await page.getByLabel('Transition').selectOption('draw')
    await page.getByLabel('Tile effect').selectOption('fade')
    await page.locator('.lb-thumb').first().click()
    await page.waitForSelector('.lb-draw-full')

    const measured = await page.evaluate(() => {
      const tile = document.querySelectorAll<HTMLElement>('.lb-tile')[1]
      const img = tile.querySelector('img')!
      return {
        cols: Number(getComputedStyle(tile).getPropertyValue('--lb-cols')),
        tileWidth: tile.getBoundingClientRect().width,
        imageWidth: img.getBoundingClientRect().width,
      }
    })

    // The image spans the whole grid, not the one tile showing part of it.
    expect(measured.cols).toBeGreaterThan(1)
    expect(measured.imageWidth).toBeCloseTo(measured.tileWidth * measured.cols, 0)
  })

  test('opens as a modal dialog and gives focus back on close', async ({ page }) => {
    const thumb = page.locator('.lb-thumb').first()
    await thumb.click()
    const overlay = openOverlay(page)
    await expect(overlay).toHaveClass(/is-open/)
    expect(await overlay.evaluate((node) => node.matches('dialog:modal'))).toBe(true)
    await expect(overlay.locator('.lb-close')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(overlay).toHaveCount(0)
    await expect(thumb).toBeFocused()
  })

  test('the picture fills the stage', async ({ page }) => {
    await page.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay).toHaveClass(/is-open/)
    await settled(page)
    const [stage, img] = await Promise.all([
      overlay.locator('.lb-stage').boundingBox(),
      overlay.locator('.lb-img').boundingBox(),
    ])
    expect(img).toEqual(stage)
  })

  test('pop closes into the thumbnail of the image on show', async ({ page }) => {
    await page.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay).toHaveClass(/is-open/)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(overlay.locator('.lb-counter')).toHaveText('Image 3 of 6')
    await settled(page)

    // Where the third thumbnail sits relative to the stage, measured at rest.
    const expected = await page.evaluate(() => {
      const centre = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2]
      const [tx, ty] = centre(document.querySelectorAll('.lb-thumb')[2].getBoundingClientRect())
      const [sx, sy] = centre(document.querySelector('.lb-stage')!.getBoundingClientRect())
      return { dx: tx - sx, dy: ty - sy }
    })
    await page.keyboard.press('Escape')
    const from = await overlay
      .locator('.lb-stage')
      .evaluate((stage) => stage.style.getPropertyValue('--lb-pop-from'))
    const [dx, dy] = from.match(/-?[\d.]+(?=px)/g)!.map(Number)
    expect(dx).toBeCloseTo(expected.dx, 0)
    expect(dy).toBeCloseTo(expected.dy, 0)
  })

  test('a mouse drag that ends off the picture leaves the overlay open', async ({ page }) => {
    await page.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay).toHaveClass(/is-open/)
    await settled(page)
    const stage = (await overlay.locator('.lb-stage').boundingBox())!
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2)
    await page.mouse.down()
    // Up into the empty margin above the stage: not far enough sideways to
    // navigate, and upwards, so not a swipe to close either.
    await page.mouse.move(stage.x + stage.width / 2, stage.y - 20, { steps: 5 })
    await page.mouse.up()
    await expect(overlay).toHaveClass(/is-open/)
  })

  test('backdrop click closes the overlay', async ({ page }) => {
    await page.locator('.lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay).toHaveClass(/is-open/)
    await overlay.locator('.lb-backdrop').click({ position: { x: 5, y: 5 }, force: true })
    await expect(overlay).toHaveCount(0)
  })
})

test.describe('Vanilla demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vanilla', { waitUntil: 'domcontentloaded' })
  })

  test('opens from a server-rendered thumbnail without React', async ({ page }) => {
    await page.locator('#vanilla-city .lb-thumb').first().click()
    const overlay = openOverlay(page)
    await expect(overlay).toHaveClass(/is-open/)
    await expect(overlay.locator('.lb-counter')).toHaveText('Image 1 of 4')
    await expect(overlay.locator('.lb-title')).toHaveText('Old castle')
    await page.keyboard.press('Escape')
    await expect(overlay).toHaveCount(0)
  })

  test('gallery:open event opens the requested image', async ({ page }) => {
    await page.locator('#external-open').click()
    const overlay = openOverlay(page)
    await expect(overlay.locator('.lb-counter')).toHaveText('Image 3 of 6')
    await expect(overlay.locator('.lb-title')).toHaveText('Highland mist')
  })
})

// Not in the describe above: the response listener must be attached before the
// first navigation, or cached loads report nothing.
test('the vanilla page ships a small framework-free bundle', async ({ page }) => {
  const sizes: Promise<number>[] = []
  page.on('response', (response) => {
    if (response.url().includes('.js')) {
      sizes.push(
        response
          .body()
          .then((body) => body.length)
          .catch(() => 0),
      )
    }
  })
  await page.goto('/vanilla', { waitUntil: 'networkidle' })
  const total = (await Promise.all(sizes)).reduce((a, b) => a + b, 0)
  expect(total).toBeGreaterThan(0)
  // The React runtime alone is ~180 KB; the whole vanilla page stays tiny.
  expect(total).toBeLessThan(60_000)
})
