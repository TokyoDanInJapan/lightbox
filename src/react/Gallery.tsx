import { useEffect, useMemo, useRef } from 'react'
import { createLightbox, type LightboxController, type LightboxUpdate } from '../core/lightbox.js'
import { defaultThumbnailSizes, thumbnailAttributes } from '../thumbnail.js'
import type { GalleryImage, ThemeSetting, TransitionSetting, UIStrings } from '../types.js'

export interface GalleryProps {
  images: GalleryImage[]
  /** Locale for captions and UI chrome. Defaults to 'en'. */
  locale?: string
  /** 'light' | 'dark' | 'auto' (follows prefers-color-scheme). Defaults to 'auto'. */
  theme?: ThemeSetting
  /**
   * Open/close animation of the full-size view: a kind ('pop' | 'fade' |
   * 'slide' | 'draw' | 'spin' | 'roll') or a config object such as
   * `{ kind: 'draw', duration: 1200, cols: 8, rows: 6 }`. Defaults to 'pop'.
   */
  transition?: TransitionSetting
  /** `sizes` attribute for thumbnail images. */
  thumbnailSizes?: string
  /**
   * How many thumbnails, from the start, load straight away rather than
   * lazily. The ones visible on arrival should not wait. Defaults to 4.
   */
  eagerThumbnails?: number
  /** Override or extend the built-in UI strings per locale. */
  uiStrings?: Partial<Record<string, Partial<UIStrings>>>
  className?: string
}

/**
 * Thumbnail grid backed by the framework-free lightbox core. The grid is
 * React; the overlay is plain DOM created by `createLightbox`.
 */
export function Gallery({
  images,
  locale = 'en',
  theme = 'auto',
  transition = 'pop',
  thumbnailSizes = defaultThumbnailSizes,
  eagerThumbnails = 4,
  uiStrings,
  className,
}: GalleryProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<LightboxController | null>(null)

  // One controller for the life of the component, so a re-render never closes
  // an open overlay. Its settings arrive through update() below.
  useEffect(() => {
    const root = rootRef.current
    const controller = createLightbox({
      images: [],
      container: root ?? undefined,
      triggerFor: (index) => root?.querySelectorAll<HTMLElement>('.lb-thumb')[index],
    })
    controllerRef.current = controller
    return () => {
      controllerRef.current = null
      controller.destroy()
    }
  }, [])

  // Settings are compared by value: callers often pass fresh literals on every
  // render (`images={data.map(...)}`), and those should not count as changes.
  // JSON drops an undefined `uiStrings`, so it is put back to clear old ones.
  const settingsKey = JSON.stringify({ images, locale, theme, transition, uiStrings })
  const settings = useMemo(
    (): LightboxUpdate => ({ uiStrings: undefined, ...JSON.parse(settingsKey) }),
    [settingsKey],
  )
  useEffect(() => {
    controllerRef.current?.update(settings)
  }, [settings])

  return (
    <div
      ref={rootRef}
      className={className ? `lb-gallery ${className}` : 'lb-gallery'}
      data-lb-theme={theme}
    >
      <ul className="lb-grid">
        {images.map((image, i) => {
          const thumb = thumbnailAttributes(image, locale, thumbnailSizes)
          return (
            <li key={image.id ?? i}>
              <button
                type="button"
                className="lb-thumb"
                aria-label={thumb.label}
                onClick={(e) => controllerRef.current?.open(i, e.currentTarget)}
              >
                <img
                  src={thumb.src}
                  srcSet={thumb.srcset}
                  sizes={thumb.sizes}
                  alt={thumb.alt}
                  loading={i < eagerThumbnails ? 'eager' : 'lazy'}
                  decoding="async"
                  width={thumb.width}
                  height={thumb.height}
                />
                {thumb.title && <span className="lb-thumb-title">{thumb.title}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
