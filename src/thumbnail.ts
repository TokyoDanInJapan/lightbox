import { resolveText } from './i18n.js'
import type { GalleryImage } from './types.js'
import { smallestSource, toSrcSet } from './utils.js'

/** The `sizes` the bundled grid's thumbnails are drawn at. */
export const defaultThumbnailSizes = '(max-width: 600px) 45vw, 240px'

export interface ThumbnailAttributes {
  /** Accessible name for the button that opens the image. */
  label: string
  /** Visible caption, or '' when the image has no title. */
  title: string
  src: string
  srcset: string
  sizes: string
  alt: string
  width: number
  height: number
}

/**
 * Everything a thumbnail button and its image need, in one place, so the
 * React grid, a server-rendered page and any other markup stay in step.
 */
export function thumbnailAttributes(
  image: GalleryImage,
  locale: string,
  sizes: string = defaultThumbnailSizes,
): ThumbnailAttributes {
  const sources = image.thumbnailSources ?? image.sources
  const title = resolveText(image.title, locale)
  const alt = resolveText(image.alt, locale) || title
  return {
    label: title || alt,
    title,
    src: smallestSource(sources).src,
    srcset: toSrcSet(sources),
    sizes,
    alt,
    width: image.width,
    height: image.height,
  }
}
