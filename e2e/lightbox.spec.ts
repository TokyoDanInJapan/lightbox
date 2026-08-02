import { expect, test, type Page } from '@playwright/test'

const openOverlay = (page: Page) => page.locator('.lb-overlay')

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
          if (Number(style.opacity) >= 0.9 && away > (window as unknown as { __far: number }).__far) {
            ;(window as unknown as { __far: number }).__far = away
          }
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })

    await page.locator('.lb-thumb').first().click()
    await page.waitForTimeout(1200)

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
      sizes.push(response.body().then((body) => body.length).catch(() => 0))
    }
  })
  await page.goto('/vanilla', { waitUntil: 'load' })
  await page.waitForTimeout(500)
  const total = (await Promise.all(sizes)).reduce((a, b) => a + b, 0)
  expect(total).toBeGreaterThan(0)
  // The React runtime alone is ~180 KB; the whole vanilla page stays tiny.
  expect(total).toBeLessThan(60_000)
})
