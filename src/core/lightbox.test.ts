import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLightbox, type LightboxController } from './lightbox.js'
import type { GalleryImage } from '../types.js'

const image = (id: number): GalleryImage => ({
  id: String(id),
  sources: [
    { src: `/img-${id}-480.jpg`, width: 480 },
    { src: `/img-${id}-960.jpg`, width: 960 },
  ],
  width: 960,
  height: 640,
  title: { en: `Title ${id}`, ja: `題${id}` },
  description: { en: `Description ${id}`, ja: `説明${id}` },
})

const images = [image(1), image(2), image(3)]

/** A transition fast enough that close completes within a few ms. */
const FAST = { kind: 'fade', duration: 10 } as const

const overlay = () => document.querySelector<HTMLElement>('.lb-overlay')
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let controller: LightboxController | null = null

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  controller?.destroy()
  controller = null
})

describe('createLightbox', () => {
  it('opens an overlay with dialog semantics, counter and caption', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    const root = overlay()
    expect(root).not.toBeNull()
    expect(root!.getAttribute('role')).toBe('dialog')
    expect(root!.getAttribute('aria-modal')).toBe('true')
    expect(root!.querySelector('.lb-counter')!.textContent).toBe('Image 1 of 3')
    expect(root!.querySelector('.lb-title')!.textContent).toBe('Title 1')
    expect(root!.querySelector('.lb-desc')!.textContent).toBe('Description 1')
  })

  it('reaches the is-open phase after a couple of frames', async () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    await frame()
    await frame()
    await frame()
    expect(overlay()!.classList.contains('is-open')).toBe(true)
  })

  it('clamps an out-of-range index', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(99)
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 3 of 3')
  })

  it('navigates with wrap-around', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(2)
    controller.next()
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 1 of 3')
    controller.prev()
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 3 of 3')
  })

  it('navigates with the arrow keys and closes with Escape', async () => {
    const onClose = vi.fn()
    controller = createLightbox({ images, transition: FAST, onClose })
    controller.open(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 2 of 3')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(overlay()!.classList.contains('is-closing')).toBe(true)
    await sleep(120)
    expect(overlay()).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll while open and restores it after close', async () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    expect(document.body.style.overflow).toBe('hidden')
    controller.close()
    await sleep(120)
    expect(document.body.style.overflow).toBe('')
  })

  it('opens at an index via the gallery:open event on its container', () => {
    const container = document.createElement('section')
    document.body.appendChild(container)
    controller = createLightbox({ images, transition: FAST, container })
    container.dispatchEvent(new CustomEvent('gallery:open', { detail: { index: 1 } }))
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 2 of 3')
  })

  it('re-renders captions and counter when the locale changes', () => {
    controller = createLightbox({ images, locale: 'en', transition: FAST })
    controller.open(0)
    controller.setLocale('ja')
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('3枚中1枚目')
    expect(overlay()!.querySelector('.lb-title')!.textContent).toBe('題1')
  })

  it('builds the configured tile grid for the draw transition', () => {
    controller = createLightbox({
      images,
      transition: { kind: 'draw', duration: 20, cols: 3, rows: 2 },
    })
    controller.open(0)
    expect(overlay()!.querySelectorAll('.lb-tile')).toHaveLength(6)
    expect(overlay()!.querySelector('.lb-draw')).not.toBeNull()
  })

  it('adds a roll bar for the roll transition', () => {
    controller = createLightbox({ images, transition: { kind: 'roll', duration: 20 } })
    controller.open(0)
    expect(overlay()!.querySelector('.lb-roll-bar')).not.toBeNull()
  })

  it('sets a pop origin when open() receives a trigger with a size', () => {
    const rect = { left: 10, top: 20, width: 100, height: 50, right: 110, bottom: 70, x: 10, y: 20, toJSON: () => ({}) } as DOMRect
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    controller = createLightbox({ images, transition: { kind: 'pop', duration: 10 } })
    controller.open(0, trigger)
    const stage = overlay()!.querySelector<HTMLElement>('.lb-stage')!
    expect(stage.style.getPropertyValue('--lb-pop-from')).toContain('scale(1)')
    spy.mockRestore()
  })

  it('does not open twice', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    controller.open(1)
    expect(document.querySelectorAll('.lb-overlay')).toHaveLength(1)
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 1 of 3')
  })

  it('destroy removes the overlay immediately and unbinds the container', () => {
    const container = document.createElement('section')
    document.body.appendChild(container)
    controller = createLightbox({ images, transition: FAST, container })
    controller.open(0)
    controller.destroy()
    expect(overlay()).toBeNull()
    container.dispatchEvent(new CustomEvent('gallery:open', { detail: { index: 0 } }))
    expect(overlay()).toBeNull()
    controller = null
  })

  it('asks for the width the default stage draws, not the full viewport', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    const img = overlay()!.querySelector<HTMLImageElement>('.lb-img')!
    expect(img.getAttribute('sizes')).toBe('min(92vw, calc(76vh * 1.5))')
  })

  it('honours a per-image sizes override', () => {
    const custom = [{ ...image(1), sizes: '100vw' }]
    controller = createLightbox({ images: custom, transition: FAST })
    controller.open(0)
    const img = overlay()!.querySelector<HTMLImageElement>('.lb-img')!
    expect(img.getAttribute('sizes')).toBe('100vw')
  })

  it('exposes the aspect ratio to CSS in both forms', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    const stage = overlay()!.querySelector<HTMLElement>('.lb-stage')!
    expect(stage.style.getPropertyValue('--lb-ar')).toBe('960 / 640')
    expect(stage.style.getPropertyValue('--lb-ar-num')).toBe('1.5')
    // The size itself is left to the stylesheet, so a host can restyle it.
    expect(stage.style.width).toBe('')
  })

  it('hides the previous/next buttons for a single image', () => {
    controller = createLightbox({ images: [image(1)], transition: FAST })
    controller.open(0)
    expect(overlay()!.querySelector('.lb-prev')).toBeNull()
    expect(overlay()!.querySelector('.lb-next')).toBeNull()
  })
})
