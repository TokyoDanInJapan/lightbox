import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { formatCounter, getUIStrings, resolveText } from './i18n'
import {
  resolveRollEdge,
  resolveSlideEdge,
  resolveTransition,
  rollClip,
  slideTransform,
  spinTransform,
  tileRanks,
  type ResolvedTransition,
  type RollEdge,
} from './transitions'
import { largestSource, toSrcSet } from './utils'
import type { GalleryImage, ThemeSetting, TransitionSetting, UIStrings } from './types'

const FULL_SIZES = '92vw'
/** Extra time before unmount so CSS transitions can finish. */
const CLOSE_BUFFER_MS = 60

export interface LightboxOverlayProps {
  images: GalleryImage[]
  initialIndex: number
  locale: string
  theme: ThemeSetting
  transition: TransitionSetting
  uiStrings?: Partial<Record<string, Partial<UIStrings>>>
  onClose: () => void
}

type Phase = 'opening' | 'open' | 'closing'

export function LightboxOverlay({
  images,
  initialIndex,
  locale,
  theme,
  transition,
  uiStrings,
  onClose,
}: LightboxOverlayProps) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), images.length - 1),
  )
  const [phase, setPhase] = useState<Phase>('opening')
  const [hasNavigated, setHasNavigated] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<number | undefined>(undefined)

  const strings = getUIStrings(locale, uiStrings)
  const reducedMotion = usePrefersReducedMotion()
  const effect = useMemo(
    () => resolveTransition(transition, reducedMotion),
    [transition, reducedMotion],
  )
  // Guard against the images array shrinking while the overlay is open.
  const safeIndex = Math.min(index, images.length - 1)
  const image = images[safeIndex]
  const title = resolveText(image.title, locale)
  const description = resolveText(image.description, locale)
  const alt = resolveText(image.alt, locale) || title

  // Commit the hidden initial state first, then transition to open.
  useEffect(() => {
    let raf2: number
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase('open'))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])

  const beginClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setPhase('closing')
    closeTimerRef.current = window.setTimeout(onClose, effect.duration + CLOSE_BUFFER_MS)
  }, [effect, onClose])

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), [])

  const step = useCallback(
    (delta: number) => {
      if (closingRef.current) return
      setHasNavigated(true)
      setIndex((i) => (i + delta + images.length) % images.length)
    },
    [images.length],
  )

  // Keyboard: Escape closes, arrows navigate, Tab is trapped inside the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        beginClose()
      } else if (e.key === 'ArrowRight') {
        step(1)
      } else if (e.key === 'ArrowLeft') {
        step(-1)
      } else if (e.key === 'Tab') {
        const root = rootRef.current
        if (!root) return
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !root.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !root.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [beginClose, step])

  // Lock page scroll while open; restore focus to the trigger on close.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousActive = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previousActive?.focus?.()
    }
  }, [])

  // Warm the cache for the neighbouring images.
  useEffect(() => {
    if (images.length < 2) return
    for (const delta of [1, -1]) {
      const neighbour = images[(safeIndex + delta + images.length) % images.length]
      const pre = new Image()
      pre.sizes = FULL_SIZES
      pre.srcset = toSrcSet(neighbour.sources)
      pre.src = largestSource(neighbour.sources).src
    }
  }, [safeIndex, images])

  // Touch/pointer: horizontal swipe navigates, downward swipe closes.
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null)
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1)
    } else if (dy > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      beginClose()
    }
  }

  const ratio = image.width / image.height
  const stageStyle = {
    '--lb-ar': `${image.width} / ${image.height}`,
    width: `min(92vw, calc(76vh * ${ratio}))`,
  } as CSSProperties

  const frameClass = hasNavigated && effect.kind !== 'draw' ? 'lb-frame lb-swap' : 'lb-frame'

  // Concrete edges for the directional transitions; 'random' is fixed once per open.
  const motion = useMemo((): { vars: Record<string, string>; rollEdge: RollEdge | null } => {
    if (effect.kind === 'roll') {
      const edge = resolveRollEdge(effect.slideFrom)
      return { vars: { '--lb-roll-clip': rollClip(edge) }, rollEdge: edge }
    }
    const transform = effect.kind === 'spin' ? spinTransform : slideTransform
    return {
      vars: {
        '--lb-slide-in': transform(resolveSlideEdge(effect.slideFrom)),
        '--lb-slide-out': transform(resolveSlideEdge(effect.slideTo)),
      },
      rollEdge: null,
    }
  }, [effect.kind, effect.slideFrom, effect.slideTo])

  return createPortal(
    <div
      ref={rootRef}
      className={`lb-overlay lb-t-${effect.kind} is-${phase}`}
      style={{ '--lb-dur': `${effect.duration}ms`, ...motion.vars } as CSSProperties}
      data-lb-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label={title || strings.dialogLabel}
    >
      <div className="lb-backdrop" onClick={beginClose} />
      <div
        className="lb-layout"
        onClick={(e) => {
          if (e.target === e.currentTarget) beginClose()
        }}
      >
        <div
          className="lb-stage"
          style={stageStyle}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {effect.kind === 'draw' ? (
            <DrawTiles
              key={safeIndex}
              image={image}
              alt={alt}
              closing={phase === 'closing'}
              config={effect}
            />
          ) : (
            <figure key={safeIndex} className={frameClass}>
              <img
                className="lb-img"
                src={largestSource(image.sources).src}
                srcSet={toSrcSet(image.sources)}
                sizes={FULL_SIZES}
                alt={alt}
                draggable={false}
              />
            </figure>
          )}
          {motion.rollEdge && (
            <div className={`lb-roll-bar lb-roll-bar-${motion.rollEdge}`} aria-hidden="true" />
          )}
        </div>
        {(title || description) && (
          <div className="lb-caption">
            {title && <div className="lb-title">{title}</div>}
            {description && <div className="lb-desc">{description}</div>}
          </div>
        )}
      </div>
      <div className="lb-counter" aria-live="polite">
        {formatCounter(strings.counter, safeIndex + 1, images.length)}
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        className="lb-btn lb-close"
        aria-label={strings.close}
        onClick={beginClose}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="lb-btn lb-prev"
            aria-label={strings.previous}
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="lb-btn lb-next"
            aria-label={strings.next}
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>,
    document.body,
  )
}

/**
 * 'draw' transition: the image is split into a grid of tiles that animate in
 * (and back out) one by one. The tile effect, order, grid size and directions
 * all come from the resolved transition config.
 */
function DrawTiles({
  image,
  alt,
  closing,
  config,
}: {
  image: GalleryImage
  alt: string
  closing: boolean
  config: ResolvedTransition
}) {
  const { cols, rows, duration, tileDuration, tileEffect, tileOrder, slideFrom, slideTo, stagger } =
    config
  const count = cols * rows
  const [shown, setShown] = useState(false)
  // Once every tile has arrived, a single seamless image is layered on top to
  // hide the sub-pixel seams between tiles.
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let raf2: number
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShown(true))
    })
    const timer = window.setTimeout(() => setSettled(true), duration + 60)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.clearTimeout(timer)
    }
  }, [duration])

  // Recomputed when the closing state flips so a 'random' exit re-shuffles;
  // 'sequential' and 'snake' keep the same pattern in and out.
  const delays = useMemo(
    () => tileRanks(tileOrder, cols, rows).map((rank) => Math.round(rank * stagger)),
    [closing, cols, rows, stagger, tileOrder],
  )

  // Entry/exit offsets per tile; with 'random' every tile gets its own edge.
  const tileTransforms = useMemo(() => {
    const transform = tileEffect === 'spin' ? spinTransform : slideTransform
    return Array.from({ length: count }, () => ({
      in: transform(resolveSlideEdge(slideFrom)),
      out: transform(resolveSlideEdge(slideTo)),
    }))
  }, [count, slideFrom, slideTo, tileEffect])

  const srcSet = toSrcSet(image.sources)
  const src = largestSource(image.sources).src

  const drawClass = [
    'lb-draw',
    `lb-draw-${tileEffect}`,
    shown && !closing ? 'is-shown' : '',
    closing ? 'is-hiding' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={drawClass}
      style={
        {
          '--lb-cols': cols,
          '--lb-rows': rows,
          '--lb-tile-dur': `${tileDuration}ms`,
        } as CSSProperties
      }
      role="img"
      aria-label={alt}
    >
      {Array.from({ length: count }, (_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        return (
          <div
            key={i}
            className="lb-tile"
            style={
              {
                '--d': `${delays[i]}ms`,
                '--c': col,
                '--r': row,
                '--lb-t-in': tileTransforms[i].in,
                '--lb-t-out': tileTransforms[i].out,
              } as CSSProperties
            }
          >
            <img src={src} srcSet={srcSet} sizes={FULL_SIZES} alt="" aria-hidden="true" draggable={false} />
          </div>
        )
      })}
      {settled && !closing && (
        <img
          className="lb-draw-full"
          src={src}
          srcSet={srcSet}
          sizes={FULL_SIZES}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
    </div>
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
