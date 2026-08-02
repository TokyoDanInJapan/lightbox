import type { ImageSource } from './types.js'

export function toSrcSet(sources: ImageSource[]): string {
  return [...sources]
    .sort((a, b) => a.width - b.width)
    .map((s) => `${s.src} ${s.width}w`)
    .join(', ')
}

export function largestSource(sources: ImageSource[]): ImageSource {
  return sources.reduce((a, b) => (b.width > a.width ? b : a))
}

export function smallestSource(sources: ImageSource[]): ImageSource {
  return sources.reduce((a, b) => (b.width < a.width ? b : a))
}

/** The stage's default limits, kept in step with `.lb-stage` in styles.css. */
const STAGE_MAX_W = '92vw'
const STAGE_MAX_H = '76vh'

/**
 * The `sizes` value describing how wide the stage draws an image of this shape.
 *
 * The stage is bounded on both axes, so a landscape photograph on a wide screen
 * is limited by the height, not the width. Saying `92vw` in that case asks the
 * browser for a variant around 40% wider than it will ever paint.
 */
export function defaultSizes(width: number, height: number): string {
  const ratio = height > 0 ? width / height : 1
  return `min(${STAGE_MAX_W}, calc(${STAGE_MAX_H} * ${ratio}))`
}
