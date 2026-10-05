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
  it('opens as a native modal dialog with counter and caption', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    const root = overlay()
    expect(root).toBeInstanceOf(HTMLDialogElement)
    expect((root as HTMLDialogElement).open).toBe(true)
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
    const rect = {
      left: 10,
      top: 20,
      width: 100,
      height: 50,
      right: 110,
      bottom: 70,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect
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

  it('closes with its animation when the browser asks the dialog to close', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    const cancel = new Event('cancel', { cancelable: true })
    overlay()!.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(overlay()!.classList.contains('is-closing')).toBe(true)
  })

  it('tidies up at once when the browser closes the dialog by itself', () => {
    const onClose = vi.fn()
    controller = createLightbox({ images, transition: FAST, onClose })
    controller.open(0)
    overlay()!.dispatchEvent(new Event('close'))
    expect(overlay()).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('leaves modified arrow keys to the browser', () => {
    controller = createLightbox({ images, transition: FAST })
    controller.open(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true }))
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 1 of 3')
  })

  describe('swiping', () => {
    const swipe = (from: [number, number], to: [number, number]) => {
      const stage = overlay()!.querySelector<HTMLElement>('.lb-stage')!
      const at = ([clientX, clientY]: [number, number]) => ({
        pointerId: 1,
        pointerType: 'touch',
        clientX,
        clientY,
        bubbles: true,
      })
      stage.dispatchEvent(new PointerEvent('pointerdown', at(from)))
      stage.dispatchEvent(new PointerEvent('pointerup', at(to)))
    }

    it('navigates on a horizontal swipe', () => {
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      swipe([300, 100], [100, 110])
      expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 2 of 3')
      swipe([100, 100], [300, 90])
      expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 1 of 3')
    })

    it('closes on a downward swipe', () => {
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      swipe([100, 100], [110, 300])
      expect(overlay()!.classList.contains('is-closing')).toBe(true)
    })

    it('keeps the gesture on the stage when the pointer leaves it', () => {
      const capture = vi.spyOn(Element.prototype, 'setPointerCapture')
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      swipe([100, 100], [105, 105])
      expect(capture).toHaveBeenCalledWith(1)
      capture.mockRestore()
    })
  })

  it('changes language without rebuilding the picture', () => {
    controller = createLightbox({ images, locale: 'en', transition: FAST })
    controller.open(0)
    const img = overlay()!.querySelector('.lb-img')
    controller.setLocale('ja')
    expect(overlay()!.querySelector('.lb-img')).toBe(img)
    expect(img!.getAttribute('alt')).toBe('題1')
    expect(overlay()!.querySelector('.lb-close')!.getAttribute('aria-label')).toBe('閉じる')
  })

  it('reads a regional locale as its language', () => {
    controller = createLightbox({ images, locale: 'ja-JP', transition: FAST })
    controller.open(0)
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('3枚中1枚目')
    expect(overlay()!.querySelector('.lb-title')!.textContent).toBe('題1')
  })

  describe('waiting for the image', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('starts the opening once the image has decoded', async () => {
      let decoded = () => {}
      vi.spyOn(HTMLImageElement.prototype, 'decode').mockReturnValue(
        new Promise<void>((resolve) => {
          decoded = resolve
        }),
      )
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      await sleep(30)
      expect(overlay()!.classList.contains('is-open')).toBe(false)
      decoded()
      await sleep(0)
      expect(overlay()!.classList.contains('is-open')).toBe(true)
    })

    it('opens anyway when the image is slow', async () => {
      vi.spyOn(HTMLImageElement.prototype, 'decode').mockReturnValue(new Promise<void>(() => {}))
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      await sleep(350)
      expect(overlay()!.classList.contains('is-open')).toBe(true)
    })
  })

  it("shows the trigger's thumbnail until the full image arrives", () => {
    const trigger = document.createElement('button')
    const thumb = document.createElement('img')
    thumb.src = 'https://example.com/thumb.jpg'
    trigger.appendChild(thumb)
    document.body.appendChild(trigger)
    controller = createLightbox({ images, transition: FAST })
    controller.open(0, trigger)
    const frame = overlay()!.querySelector<HTMLElement>('.lb-frame')!
    expect(frame.style.backgroundImage).toContain('https://example.com/thumb.jpg')
  })

  describe('pop origin', () => {
    // Each thumbnail sits at its own position; the stage is at the origin.
    const thumbs = [0, 1, 2].map((i) => {
      const button = document.createElement('button')
      button.dataset.left = String(1000 + i * 100)
      return button
    })
    const rect = (left: number, width: number) =>
      ({
        left,
        top: 0,
        width,
        height: width,
        right: left + width,
        bottom: width,
        x: left,
        y: 0,
      }) as DOMRect

    beforeEach(() => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const left = (this as HTMLElement).dataset?.left
        return left ? rect(Number(left), 100) : rect(0, 100)
      })
    })
    afterEach(() => {
      vi.restoreAllMocks()
    })

    const popFrom = () =>
      overlay()!.querySelector<HTMLElement>('.lb-stage')!.style.getPropertyValue('--lb-pop-from')

    it('grows out of the thumbnail triggerFor names when open() has no trigger', () => {
      controller = createLightbox({ images, transition: 'pop', triggerFor: (i) => thumbs[i] })
      controller.open(1)
      expect(popFrom()).toContain('translate(1100px')
    })

    it('shrinks into the thumbnail of the image on show after navigating', () => {
      controller = createLightbox({ images, transition: 'pop', triggerFor: (i) => thumbs[i] })
      controller.open(0, thumbs[0])
      controller.next()
      controller.next()
      controller.close()
      expect(popFrom()).toContain('translate(1200px')
    })

    it('shrinks into the centre after navigating when the thumbnail is unknown', () => {
      controller = createLightbox({ images, transition: 'pop' })
      controller.open(0, thumbs[0])
      controller.next()
      controller.close()
      expect(popFrom()).toBe('')
    })
  })

  describe('update', () => {
    it('changes the theme and text of an open overlay in place', () => {
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      const img = overlay()!.querySelector('.lb-img')
      controller.update({ theme: 'dark', locale: 'ja' })
      expect(overlay()!.dataset.lbTheme).toBe('dark')
      expect(overlay()!.querySelector('.lb-title')!.textContent).toBe('題1')
      expect(overlay()!.querySelector('.lb-img')).toBe(img)
    })

    it('redraws for new images, keeping the place where it can', () => {
      controller = createLightbox({ images, transition: FAST })
      controller.open(2)
      controller.update({ images: [image(7), image(8)] })
      expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 2 of 2')
      expect(overlay()!.querySelector('.lb-title')!.textContent).toBe('Title 8')
    })

    it('closes when the images run out', () => {
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      controller.update({ images: [] })
      expect(overlay()!.classList.contains('is-closing')).toBe(true)
    })

    it('applies a new transition from the next opening', async () => {
      controller = createLightbox({ images, transition: FAST })
      controller.open(0)
      controller.update({ transition: { kind: 'draw', duration: 10 } })
      expect(overlay()!.classList.contains('lb-t-fade')).toBe(true)
      controller.close()
      await sleep(120)
      controller.open(0)
      expect(overlay()!.classList.contains('lb-t-draw')).toBe(true)
    })
  })
})
