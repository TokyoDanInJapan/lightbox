import { useEffect, useRef } from 'react'
import { createLightbox, type LightboxController } from '../core/lightbox.js'
import { resolveText } from '../i18n.js'
import { smallestSource, toSrcSet } from '../utils.js'
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
  thumbnailSizes = '(max-width: 600px) 45vw, 240px',
  uiStrings,
  className,
}: GalleryProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<LightboxController | null>(null)

  // Recreate the controller when configuration changes. Options are compared
  // by value: demo-style callers pass fresh object literals on every render,
  // and identity comparison would tear the controller down each time.
  const optionsKey = JSON.stringify({ locale, theme, transition, uiStrings })
  useEffect(() => {
    const controller = createLightbox({
      images,
      locale,
      theme,
      transition,
      uiStrings,
      container: rootRef.current ?? undefined,
    })
    controllerRef.current = controller
    return () => {
      controllerRef.current = null
      controller.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options compared via optionsKey
  }, [images, optionsKey])

  return (
    <div
      ref={rootRef}
      className={className ? `lb-gallery ${className}` : 'lb-gallery'}
      data-lb-theme={theme}
    >
      <ul className="lb-grid">
        {images.map((image, i) => {
          const sources = image.thumbnailSources ?? image.sources
          const title = resolveText(image.title, locale)
          const alt = resolveText(image.alt, locale) || title
          return (
            <li key={image.id ?? i}>
              <button
                type="button"
                className="lb-thumb"
                aria-label={title || alt}
                onClick={(e) => controllerRef.current?.open(i, e.currentTarget)}
              >
                <img
                  src={smallestSource(sources).src}
                  srcSet={toSrcSet(sources)}
                  sizes={thumbnailSizes}
                  alt={alt}
                  loading="lazy"
                  width={image.width}
                  height={image.height}
                />
                {title && <span className="lb-thumb-title">{title}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
