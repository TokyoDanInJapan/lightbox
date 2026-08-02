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
