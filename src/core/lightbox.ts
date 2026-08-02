import { formatCounter, getUIStrings, resolveText } from '../i18n.js'
import {
  resolveRollEdge,
  resolveSlideEdge,
  resolveTransition,
  rollClip,
  slideTransform,
  spinTransform,
  tileRanks,
  type ResolvedTransition,
} from '../transitions.js'
import { largestSource, toSrcSet } from '../utils.js'
import type { GalleryImage, ThemeSetting, TransitionSetting, UIStrings } from '../types.js'
import { afterPaint, el, iconButton } from './dom.js'

const FULL_SIZES = '92vw'
/** Extra time before removal so CSS transitions can finish. */
const CLOSE_BUFFER_MS = 60

export interface LightboxOptions {
  /** The images this lightbox can show. Must contain at least one entry. */
  images: GalleryImage[]
  /** Locale for captions and UI chrome. Defaults to 'en'. */
  locale?: string
  /** 'light' | 'dark' | 'auto' (follows prefers-color-scheme). Defaults to 'auto'. */
  theme?: ThemeSetting
  /** Open/close animation: a kind or a config object. Defaults to 'pop'. */
  transition?: TransitionSetting
  /** Override or extend the built-in UI strings per locale. */
  uiStrings?: Partial<Record<string, Partial<UIStrings>>>
  /**
   * Optional host element. The controller listens on it for 'gallery:open'
   * CustomEvents (`detail: { index?: number, trigger?: HTMLElement }`), so
   * other components can ask this lightbox to open without knowing its markup.
   */
  container?: HTMLElement
  /** Called after the overlay has fully closed and been removed. */
  onClose?: () => void
}

export interface LightboxController {
  /**
   * Open the overlay at an image. When `trigger` is given and the transition
   * is 'pop', the image grows out of the trigger's on-screen position.
   */
  open(index: number, trigger?: HTMLElement): void
  /** Play the closing animation, then remove the overlay. */
  close(): void
  next(): void
  prev(): void
  /** Switch language; live captions and labels re-render in place. */
  setLocale(locale: string): void
  /** Remove all listeners and any open overlay immediately. */
  destroy(): void
}

interface Session {
  root: HTMLDivElement
  stage: HTMLDivElement
  caption: HTMLDivElement
  counter: HTMLDivElement
  index: number
  effect: ResolvedTransition
  trigger: HTMLElement | null
  closing: boolean
  hasNavigated: boolean
  previousFocus: HTMLElement | null
  previousOverflow: string
  closeTimer: number
  /** Draw-specific hook: start the tiles' exit animation. */
  concealDraw: (() => void) | null
  /** Cancel functions for pending frames and timers. */
  teardown: (() => void)[]
}

export function createLightbox(options: LightboxOptions): LightboxController {
  const { images, container, onClose } = options
  const theme = options.theme ?? 'auto'
  let locale = options.locale ?? 'en'
  let session: Session | null = null

  const strings = () => getUIStrings(locale, options.uiStrings)

  const onGalleryOpen = (event: Event) => {
    const detail = (event as CustomEvent<{ index?: number; trigger?: HTMLElement }>).detail
    open(detail?.index ?? 0, detail?.trigger)
  }
  container?.addEventListener('gallery:open', onGalleryOpen)

  function open(indexRaw: number, trigger?: HTMLElement): void {
    if (session || images.length === 0) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const effect = resolveTransition(options.transition ?? 'pop', reducedMotion)
    const index = Math.min(Math.max(indexRaw, 0), images.length - 1)

    const root = el('div', `lb-overlay lb-t-${effect.kind} is-opening`, {
      '--lb-dur': `${effect.duration}ms`,
    })
    root.dataset.lbTheme = theme
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-modal', 'true')

    // Concrete edges for the directional transitions, fixed once per open.
    let rollEdge: ReturnType<typeof resolveRollEdge> | null = null
    if (effect.kind === 'roll') {
      rollEdge = resolveRollEdge(effect.slideFrom)
      root.style.setProperty('--lb-roll-clip', rollClip(rollEdge))
    } else if (effect.kind === 'slide' || effect.kind === 'spin') {
      const transform = effect.kind === 'spin' ? spinTransform : slideTransform
      root.style.setProperty('--lb-slide-in', transform(resolveSlideEdge(effect.slideFrom)))
      root.style.setProperty('--lb-slide-out', transform(resolveSlideEdge(effect.slideTo)))
    }

    const backdrop = el('div', 'lb-backdrop')
    backdrop.addEventListener('click', close)

    const layout = el('div', 'lb-layout')
    layout.addEventListener('click', (e) => {
      if (e.target === layout) close()
    })

    const stage = el('div', 'lb-stage')
    attachPointerHandlers(stage)

    const caption = el('div', 'lb-caption')
    const counter = el('div', 'lb-counter')
    counter.setAttribute('aria-live', 'polite')

    const closeButton = iconButton('lb-btn lb-close', 'close', strings().close)
    closeButton.addEventListener('click', close)

    layout.append(stage, caption)
    root.append(backdrop, layout, counter, closeButton)

    if (images.length > 1) {
      const prevButton = iconButton('lb-btn lb-prev', 'prev', strings().previous)
      prevButton.addEventListener('click', prev)
      const nextButton = iconButton('lb-btn lb-next', 'next', strings().next)
      nextButton.addEventListener('click', next)
      root.append(prevButton, nextButton)
    }

    if (rollEdge) {
      stage.appendChild(el('div', `lb-roll-bar lb-roll-bar-${rollEdge}`))
    }

    session = {
      root,
      stage,
      caption,
      counter,
      index,
      effect,
      trigger: trigger ?? null,
      closing: false,
      hasNavigated: false,
      previousFocus: document.activeElement as HTMLElement | null,
      previousOverflow: document.body.style.overflow,
      closeTimer: 0,
      concealDraw: null,
      teardown: [],
    }

    document.body.appendChild(root)
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    closeButton.focus()

    renderImage()

    // Pop grows out of the trigger when we know where it is. The stage already
    // has its final layout (transforms do not affect it), so measure now.
    if (effect.kind === 'pop' && trigger) {
      const from = trigger.getBoundingClientRect()
      const to = stage.getBoundingClientRect()
      if (to.width > 0 && to.height > 0) {
        const dx = from.left + from.width / 2 - (to.left + to.width / 2)
        const dy = from.top + from.height / 2 - (to.top + to.height / 2)
        const scale = Math.max(from.width / to.width, from.height / to.height)
        stage.style.setProperty('--lb-pop-from', `translate(${dx}px, ${dy}px) scale(${scale})`)
      }
    }

    session.teardown.push(
      afterPaint(() => {
        if (session && !session.closing) {
          root.classList.remove('is-opening')
          root.classList.add('is-open')
        }
      }),
    )
  }

  function close(): void {
    const s = session
    if (!s || s.closing) return
    s.closing = true
    s.concealDraw?.()
    s.root.classList.remove('is-open', 'is-opening')
    s.root.classList.add('is-closing')
    s.closeTimer = window.setTimeout(finishClose, s.effect.duration + CLOSE_BUFFER_MS)
  }

  function finishClose(): void {
    const s = session
    if (!s) return
    for (const cancel of s.teardown) cancel()
    window.clearTimeout(s.closeTimer)
    window.removeEventListener('keydown', onKeyDown)
    s.root.remove()
    document.body.style.overflow = s.previousOverflow
    s.previousFocus?.focus?.()
    session = null
    onClose?.()
  }

  function step(delta: number): void {
    const s = session
    if (!s || s.closing) return
    s.hasNavigated = true
    s.index = (s.index + delta + images.length) % images.length
    renderImage()
  }

  const next = () => step(1)
  const prev = () => step(-1)

  /** (Re)build the stage contents, caption, counter and labels for s.index. */
  function renderImage(): void {
    const s = session
    if (!s) return
    const image = images[s.index]
    const title = resolveText(image.title, locale)
    const description = resolveText(image.description, locale)
    const alt = resolveText(image.alt, locale) || title

    const ratio = image.width / image.height
    s.stage.style.setProperty('--lb-ar', `${image.width} / ${image.height}`)
    s.stage.style.width = `min(92vw, calc(76vh * ${ratio}))`

    // Replace the frame but keep the roll bar, which animates independently.
    s.stage.querySelector('.lb-frame')?.remove()
    s.stage.querySelector('.lb-draw')?.remove()
    s.concealDraw = null

    if (s.effect.kind === 'draw') {
      s.stage.prepend(buildDraw(s, image, alt))
    } else {
      const frame = el('figure', s.hasNavigated ? 'lb-frame lb-swap' : 'lb-frame')
      frame.appendChild(buildImg('lb-img', image, alt))
      s.stage.prepend(frame)
    }

    s.root.setAttribute('aria-label', title || strings().dialogLabel)
    s.counter.textContent = formatCounter(strings().counter, s.index + 1, images.length)

    s.caption.replaceChildren()
    if (title) {
      const node = el('div', 'lb-title')
      node.textContent = title
      s.caption.appendChild(node)
    }
    if (description) {
      const node = el('div', 'lb-desc')
      node.textContent = description
      s.caption.appendChild(node)
    }
    s.caption.style.display = title || description ? '' : 'none'

    preloadNeighbours(s.index)
  }

  function buildImg(className: string, image: GalleryImage, alt: string): HTMLImageElement {
    const img = el('img', className)
    img.src = largestSource(image.sources).src
    img.srcset = toSrcSet(image.sources)
    img.sizes = FULL_SIZES
    img.alt = alt
    img.draggable = false
    return img
  }

  /** The 'draw' transition: tiles that animate in (and back out) one by one. */
  function buildDraw(s: Session, image: GalleryImage, alt: string): HTMLDivElement {
    const { cols, rows, duration, tileDuration, tileEffect, tileOrder, slideFrom, slideTo, stagger } =
      s.effect
    const count = cols * rows
    const transform = tileEffect === 'spin' ? spinTransform : slideTransform

    const wrap = el('div', `lb-draw lb-draw-${tileEffect}`, {
      '--lb-cols': String(cols),
      '--lb-rows': String(rows),
      '--lb-tile-dur': `${tileDuration}ms`,
    })
    wrap.setAttribute('role', 'img')
    wrap.setAttribute('aria-label', alt)

    const applyDelays = () => {
      const delays = tileRanks(tileOrder, cols, rows).map((rank) => Math.round(rank * stagger))
      wrap.querySelectorAll<HTMLElement>('.lb-tile').forEach((tile, i) => {
        tile.style.setProperty('--d', `${delays[i]}ms`)
      })
    }

    for (let i = 0; i < count; i++) {
      const tile = el('div', 'lb-tile', {
        '--c': String(i % cols),
        '--r': String(Math.floor(i / cols)),
        '--lb-t-in': transform(resolveSlideEdge(slideFrom)),
        '--lb-t-out': transform(resolveSlideEdge(slideTo)),
      })
      const img = buildImg('', image, '')
      img.setAttribute('aria-hidden', 'true')
      tile.appendChild(img)
      wrap.appendChild(tile)
    }
    applyDelays()

    s.teardown.push(
      afterPaint(() => {
        if (!s.closing) wrap.classList.add('is-shown')
      }),
    )

    // Once every tile has arrived, layer a single seamless copy on top to hide
    // the sub-pixel seams between tiles.
    const settleTimer = window.setTimeout(() => {
      if (s.closing) return
      const full = buildImg('lb-draw-full', image, '')
      full.setAttribute('aria-hidden', 'true')
      wrap.appendChild(full)
    }, duration + CLOSE_BUFFER_MS)
    s.teardown.push(() => window.clearTimeout(settleTimer))

    s.concealDraw = () => {
      wrap.querySelector('.lb-draw-full')?.remove()
      // A 'random' exit re-shuffles; fixed orders keep the same pattern out.
      if (tileOrder === 'random') applyDelays()
      wrap.classList.remove('is-shown')
      wrap.classList.add('is-hiding')
    }

    return wrap
  }

  function preloadNeighbours(index: number): void {
    if (images.length < 2) return
    for (const delta of [1, -1]) {
      const neighbour = images[(index + delta + images.length) % images.length]
      const pre = new Image()
      pre.sizes = FULL_SIZES
      pre.srcset = toSrcSet(neighbour.sources)
      pre.src = largestSource(neighbour.sources).src
    }
  }

  // Keyboard: Escape closes, arrows navigate, Tab is trapped inside the dialog.
  function onKeyDown(e: KeyboardEvent): void {
    const s = session
    if (!s) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowRight') {
      next()
    } else if (e.key === 'ArrowLeft') {
      prev()
    } else if (e.key === 'Tab') {
      const focusables = s.root.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !s.root.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !s.root.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  // Touch/pointer: horizontal swipe navigates, downward swipe closes.
  function attachPointerHandlers(stage: HTMLElement): void {
    let start: { x: number; y: number; id: number } | null = null
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
    })
    stage.addEventListener('pointerup', (e) => {
      if (!start || start.id !== e.pointerId) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      start = null
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
        step(dx < 0 ? 1 : -1)
      } else if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        close()
      }
    })
  }

  function setLocale(next: string): void {
    locale = next
    const s = session
    if (!s) return
    s.root.querySelector<HTMLElement>('.lb-close')?.setAttribute('aria-label', strings().close)
    s.root.querySelector<HTMLElement>('.lb-prev')?.setAttribute('aria-label', strings().previous)
    s.root.querySelector<HTMLElement>('.lb-next')?.setAttribute('aria-label', strings().next)
    renderImage()
  }

  function destroy(): void {
    container?.removeEventListener('gallery:open', onGalleryOpen)
    if (session) finishClose()
  }

  return { open, close, next, prev, setLocale, destroy }
}
