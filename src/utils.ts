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
