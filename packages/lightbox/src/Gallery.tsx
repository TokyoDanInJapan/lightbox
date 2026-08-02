import { useState } from 'react'
import { LightboxOverlay } from './LightboxOverlay'
import { resolveText } from './i18n'
import { smallestSource, toSrcSet } from './utils'
import type { GalleryImage, ThemeSetting, TransitionSetting, UIStrings } from './types'

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

export function Gallery({
  images,
  locale = 'en',
  theme = 'auto',
  transition = 'pop',
  thumbnailSizes = '(max-width: 600px) 45vw, 240px',
  uiStrings,
  className,
}: GalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className={className ? `lb-gallery ${className}` : 'lb-gallery'} data-lb-theme={theme}>
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
                onClick={() => setOpenIndex(i)}
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
      {openIndex !== null && (
        <LightboxOverlay
          images={images}
          initialIndex={openIndex}
          locale={locale}
          theme={theme}
          transition={transition}
          uiStrings={uiStrings}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}
