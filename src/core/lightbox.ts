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
import { defaultSizes, largestSource, toSrcSet } from '../utils.js'
import type { GalleryImage, ThemeSetting, TransitionSetting, UIStrings } from '../types.js'
import { el, flushStyles, iconButton, whenDecoded } from './dom.js'

/** Extra time before removal so CSS transitions can finish. */
const CLOSE_BUFFER_MS = 60

/**
 * The longest an opening waits for its image before animating without it.
 * Long enough for a cached or nearby image to arrive, short enough that a
 * click never feels ignored on a slow connection.
 */
const DECODE_LIMIT_MS = 300

/** The `sizes` an image asks for: its own, or the default stage geometry. */
const sizesFor = (image: GalleryImage): string =>
  image.sizes ?? defaultSizes(image.width, image.height)

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
  /**
   * The on-page element showing image `index`, usually its thumbnail button.
   * With it, 'pop' grows out of the right thumbnail even when `open()` is
   * given no trigger, and shrinks back into the thumbnail of the image on
   * show at close rather than the one that was clicked.
   */
  triggerFor?: (index: number) => HTMLElement | null | undefined
  /** Called after the overlay has fully closed and been removed. */
  onClose?: () => void
}

/** The options `update()` can change on a live controller. */
export type LightboxUpdate = Partial<
  Pick<LightboxOptions, 'images' | 'locale' | 'theme' | 'transition' | 'uiStrings'>
>

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
  /**
   * Change options without recreating the controller. An open overlay keeps
   * its place: text and theme change in place, and the picture is only redrawn
   * when `images` changes. A new `transition` applies from the next opening.
   */
  update(changes: LightboxUpdate): void
  /** Switch language; live captions and labels re-render in place. */
  setLocale(locale: string): void
  /** Remove all listeners and any open overlay immediately. */
  destroy(): void
}

interface Session {
  root: HTMLDialogElement
  stage: HTMLDivElement
  caption: HTMLDivElement
  counter: HTMLDivElement
  closeButton: HTMLButtonElement
  prevButton: HTMLButtonElement | null
  nextButton: HTMLButtonElement | null
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
  /** Cancels the timers of the picture on show; run when it is replaced. */
  frameTeardown: (() => void)[]
}

export function createLightbox(options: LightboxOptions): LightboxController {
  const { container, onClose, triggerFor } = options
  let settings: LightboxUpdate & Pick<LightboxOptions, 'images'> = {
    images: options.images,
    locale: options.locale,
    theme: options.theme,
    transition: options.transition,
    uiStrings: options.uiStrings,
  }
  let session: Session | null = null

  const locale = () => settings.locale ?? 'en'
  const theme = () => settings.theme ?? 'auto'
  const strings = () => getUIStrings(locale(), settings.uiStrings)

  const onGalleryOpen = (event: Event) => {
    const detail = (event as CustomEvent<{ index?: number; trigger?: HTMLElement }>).detail
    open(detail?.index ?? 0, detail?.trigger)
  }
  container?.addEventListener('gallery:open', onGalleryOpen)

  function open(indexRaw: number, trigger?: HTMLElement): void {
    const { images } = settings
    if (session || images.length === 0) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const effect = resolveTransition(settings.transition ?? 'pop', reducedMotion)
    const index = Math.min(Math.max(indexRaw, 0), images.length - 1)

    // A native modal dialog sits in the top layer and makes the rest of the
    // page inert, so focus and assistive technology stay inside it.
    const root = el('dialog', `lb-overlay lb-t-${effect.kind} is-opening`, {
      '--lb-dur': `${effect.duration}ms`,
    })
    root.dataset.lbTheme = theme()
    // Escape is handled in onKeyDown; this catches the other ways a browser
    // asks a dialog to close, such as the Android back gesture.
    root.addEventListener('cancel', (e) => {
      e.preventDefault()
      close()
    })
    // A browser may close the dialog without asking, for instance on a second
    // Escape during the closing animation. Tidy up rather than leave it inert.
    root.addEventListener('close', () => {
      if (session?.root === root) finishClose()
    })

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

    let prevButton: HTMLButtonElement | null = null
    let nextButton: HTMLButtonElement | null = null
    if (images.length > 1) {
      prevButton = iconButton('lb-btn lb-prev', 'prev', strings().previous)
      prevButton.addEventListener('click', prev)
      nextButton = iconButton('lb-btn lb-next', 'next', strings().next)
      nextButton.addEventListener('click', next)
      root.append(prevButton, nextButton)
    }

    if (rollEdge) {
      stage.appendChild(el('div', `lb-roll-bar lb-roll-bar-${rollEdge}`))
    }

    const s: Session = {
      root,
      stage,
      caption,
      counter,
      closeButton,
      prevButton,
      nextButton,
      index,
      effect,
      trigger: trigger ?? triggerFor?.(index) ?? null,
      closing: false,
      hasNavigated: false,
      previousFocus: document.activeElement as HTMLElement | null,
      previousOverflow: document.body.style.overflow,
      closeTimer: 0,
      concealDraw: null,
      frameTeardown: [],
    }
    session = s

    document.body.appendChild(root)
    root.showModal()
    // A modal dialog does not stop the page behind it scrolling.
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    closeButton.focus()

    const img = renderImage(s)

    // Pop grows out of the trigger when we know where it is. The stage already
    // has its final layout (transforms do not affect it), so measure now.
    if (effect.kind === 'pop') {
      const from = popOrigin(s.trigger, stage)
      if (from) stage.style.setProperty('--lb-pop-from', from)
    }

    whenDecoded(img, DECODE_LIMIT_MS).then(() => {
      if (session !== s || s.closing) return
      flushStyles(root)
      root.classList.replace('is-opening', 'is-open')
    })
  }

  function close(): void {
    const s = session
    if (!s || s.closing) return
    s.closing = true
    if (s.effect.kind === 'pop' && s.hasNavigated) {
      // Shrink into the thumbnail of the image now on show, not the one that
      // was opened, or into the centre when that thumbnail is not known.
      const from = popOrigin(triggerFor?.(s.index) ?? null, s.stage)
      if (from) s.stage.style.setProperty('--lb-pop-from', from)
      else s.stage.style.removeProperty('--lb-pop-from')
    }
    s.concealDraw?.()
    s.root.classList.remove('is-open', 'is-opening')
    s.root.classList.add('is-closing')
    s.closeTimer = window.setTimeout(finishClose, s.effect.duration + CLOSE_BUFFER_MS)
  }

  function finishClose(): void {
    const s = session
    if (!s) return
    for (const cancel of s.frameTeardown) cancel()
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
    const count = settings.images.length
    s.hasNavigated = true
    s.index = (s.index + delta + count) % count
    renderImage(s)
  }

  const next = () => step(1)
  const prev = () => step(-1)

  /**
   * (Re)build the picture for s.index, then its text. Returns the image the
   * opening waits for before it starts to animate.
   */
  function renderImage(s: Session): HTMLImageElement {
    const image = settings.images[s.index]
    for (const cancel of s.frameTeardown.splice(0)) cancel()

    // Both forms of the aspect ratio: `--lb-ar` for `aspect-ratio`, which needs
    // a <ratio>, and `--lb-ar-num` for the width calc, which needs a number.
    // The stage's size lives in the stylesheet rather than here so a host can
    // restyle it - an inline width would need !important to override.
    s.stage.style.setProperty('--lb-ar', `${image.width} / ${image.height}`)
    s.stage.style.setProperty('--lb-ar-num', String(image.width / image.height))

    // Replace the frame but keep the roll bar, which animates independently.
    s.stage.querySelector('.lb-frame')?.remove()
    s.stage.querySelector('.lb-draw')?.remove()
    s.concealDraw = null

    let img: HTMLImageElement
    if (s.effect.kind === 'draw') {
      const draw = buildDraw(s, image)
      s.stage.prepend(draw.wrap)
      img = draw.img
    } else {
      const frame = el('figure', s.hasNavigated ? 'lb-frame lb-swap' : 'lb-frame')
      // Until the full image arrives, show the thumbnail the browser already
      // has, so a slow image grows out of a picture rather than an empty box.
      const placeholder = s.hasNavigated ? '' : thumbnailSource(s.trigger)
      if (placeholder) frame.style.backgroundImage = `url(${JSON.stringify(placeholder)})`
      img = buildImg('lb-img', image)
      frame.appendChild(img)
      s.stage.prepend(frame)
    }

    renderText(s)
    preloadNeighbours(s.index)
    return img
  }

  /** Caption, counter and every label: the parts a change of locale touches. */
  function renderText(s: Session): void {
    const image = settings.images[s.index]
    const text = strings()
    const title = resolveText(image.title, locale())
    const description = resolveText(image.description, locale())
    const alt = resolveText(image.alt, locale()) || title

    s.root.setAttribute('aria-label', title || text.dialogLabel)
    s.closeButton.setAttribute('aria-label', text.close)
    s.prevButton?.setAttribute('aria-label', text.previous)
    s.nextButton?.setAttribute('aria-label', text.next)
    s.counter.textContent = formatCounter(text.counter, s.index + 1, settings.images.length)
    s.stage.querySelector('.lb-img')?.setAttribute('alt', alt)
    s.stage.querySelector('.lb-draw')?.setAttribute('aria-label', alt)

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
  }

  function buildImg(className: string, image: GalleryImage): HTMLImageElement {
    const img = el('img', className)
    img.sizes = sizesFor(image)
    img.srcset = toSrcSet(image.sources)
    img.src = largestSource(image.sources).src
    img.alt = ''
    img.draggable = false
    return img
  }

  /** The 'draw' transition: tiles that animate in (and back out) one by one. */
  function buildDraw(
    s: Session,
    image: GalleryImage,
  ): { wrap: HTMLDivElement; img: HTMLImageElement } {
    const {
      cols,
      rows,
      duration,
      tileDuration,
      tileEffect,
      tileOrder,
      slideFrom,
      slideTo,
      stagger,
    } = s.effect
    const count = cols * rows
    const transform = tileEffect === 'spin' ? spinTransform : slideTransform

    const wrap = el('div', `lb-draw lb-draw-${tileEffect}`, {
      '--lb-cols': String(cols),
      '--lb-rows': String(rows),
      '--lb-tile-dur': `${tileDuration}ms`,
    })
    wrap.setAttribute('role', 'img')

    const applyDelays = () => {
      const delays = tileRanks(tileOrder, cols, rows).map((rank) => Math.round(rank * stagger))
      wrap.querySelectorAll<HTMLElement>('.lb-tile').forEach((tile, i) => {
        tile.style.setProperty('--d', `${delays[i]}ms`)
      })
    }

    const imgs: HTMLImageElement[] = []
    for (let i = 0; i < count; i++) {
      const tile = el('div', 'lb-tile', {
        '--c': String(i % cols),
        '--r': String(Math.floor(i / cols)),
        '--lb-t-in': transform(resolveSlideEdge(slideFrom)),
        '--lb-t-out': transform(resolveSlideEdge(slideTo)),
      })
      const img = buildImg('', image)
      img.setAttribute('aria-hidden', 'true')
      tile.appendChild(img)
      wrap.appendChild(tile)
      imgs.push(img)
    }
    applyDelays()

    // The tiles all show the same picture, so once one can paint, all can.
    let replaced = false
    s.frameTeardown.push(() => {
      replaced = true
    })
    whenDecoded(imgs[0], DECODE_LIMIT_MS).then(() => {
      if (replaced || s.closing) return
      flushStyles(wrap)
      wrap.classList.add('is-shown')

      // Once every tile has arrived, layer a single seamless copy on top to
      // hide the sub-pixel seams between tiles.
      const settleTimer = window.setTimeout(() => {
        if (s.closing) return
        const full = buildImg('lb-draw-full', image)
        full.setAttribute('aria-hidden', 'true')
        wrap.appendChild(full)
      }, duration + CLOSE_BUFFER_MS)
      s.frameTeardown.push(() => window.clearTimeout(settleTimer))
    })

    s.concealDraw = () => {
      wrap.querySelector('.lb-draw-full')?.remove()
      // A 'random' exit re-shuffles; fixed orders keep the same pattern out.
      if (tileOrder === 'random') applyDelays()
      wrap.classList.remove('is-shown')
      wrap.classList.add('is-hiding')
    }

    return { wrap, img: imgs[0] }
  }

  function preloadNeighbours(index: number): void {
    const { images } = settings
    if (images.length < 2) return
    for (const delta of [1, -1]) {
      const neighbour = images[(index + delta + images.length) % images.length]
      const pre = new Image()
      pre.sizes = sizesFor(neighbour)
      pre.srcset = toSrcSet(neighbour.sources)
      pre.src = largestSource(neighbour.sources).src
    }
  }

  // Keyboard: Escape closes and the arrows navigate. Focus stays inside the
  // dialog without help, because showModal() makes the page behind it inert.
  function onKeyDown(e: KeyboardEvent): void {
    // Leave browser shortcuts such as Alt+Left (back) to the browser.
    if (!session || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowRight') {
      next()
    } else if (e.key === 'ArrowLeft') {
      prev()
    }
  }

  // Touch/pointer: horizontal swipe navigates, downward swipe closes.
  function attachPointerHandlers(stage: HTMLElement): void {
    let start: { x: number; y: number; id: number } | null = null
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      // Keep the gesture on the stage even when it ends outside it. Without
      // this, a mouse drag released over the margin is missed here and lands
      // as a click on the layout, which closes the overlay.
      stage.setPointerCapture(e.pointerId)
    })
    stage.addEventListener('pointercancel', () => {
      start = null
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

  function update(changes: LightboxUpdate): void {
    const imagesChanged = changes.images !== undefined && changes.images !== settings.images
    settings = { ...settings, ...changes, images: changes.images ?? settings.images }
    const s = session
    if (!s) return
    if (imagesChanged && settings.images.length === 0) {
      close()
      return
    }
    s.root.dataset.lbTheme = theme()
    if (imagesChanged) {
      s.index = Math.min(s.index, settings.images.length - 1)
      renderImage(s)
    } else {
      renderText(s)
    }
  }

  function setLocale(next: string): void {
    update({ locale: next })
  }

  function destroy(): void {
    container?.removeEventListener('gallery:open', onGalleryOpen)
    if (session) finishClose()
  }

  return { open, close, next, prev, update, setLocale, destroy }
}

/**
 * The transform that places the stage over `trigger`, for 'pop' to grow out
 * of or shrink into. Null when there is no trigger or nothing to measure.
 */
function popOrigin(trigger: HTMLElement | null, stage: HTMLElement): string | null {
  if (!trigger) return null
  const from = trigger.getBoundingClientRect()
  const to = stage.getBoundingClientRect()
  if (to.width <= 0 || to.height <= 0) return null
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const scale = Math.max(from.width / to.width, from.height / to.height)
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

/**
 * The address of the picture a trigger is already showing: the trigger itself
 * when it is an image, or the first image inside it. That image has loaded,
 * so it can stand in for the full one at no cost.
 */
function thumbnailSource(trigger: HTMLElement | null): string {
  const img = trigger instanceof HTMLImageElement ? trigger : trigger?.querySelector('img')
  return img?.currentSrc || img?.src || ''
}
