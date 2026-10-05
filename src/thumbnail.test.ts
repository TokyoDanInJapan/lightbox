import { describe, expect, it } from 'vitest'
import { defaultThumbnailSizes, thumbnailAttributes } from './thumbnail.js'
import type { GalleryImage } from './types.js'

const image: GalleryImage = {
  sources: [
    { src: '/full-1920.jpg', width: 1920 },
    { src: '/full-960.jpg', width: 960 },
  ],
  width: 1920,
  height: 1280,
  title: { en: 'River', ja: '川' },
}

describe('thumbnailAttributes', () => {
  it('uses the smallest source as the fallback src and lists them all', () => {
    const thumb = thumbnailAttributes(image, 'en')
    expect(thumb.src).toBe('/full-960.jpg')
    expect(thumb.srcset).toBe('/full-960.jpg 960w, /full-1920.jpg 1920w')
    expect(thumb.sizes).toBe(defaultThumbnailSizes)
    expect([thumb.width, thumb.height]).toEqual([1920, 1280])
  })

  it('prefers dedicated thumbnail sources', () => {
    const thumb = thumbnailAttributes(
      { ...image, thumbnailSources: [{ src: '/thumb-320.jpg', width: 320 }] },
      'en',
    )
    expect(thumb.src).toBe('/thumb-320.jpg')
  })

  it('falls back from alt to title, and labels the button with the title', () => {
    const thumb = thumbnailAttributes(image, 'ja')
    expect(thumb).toMatchObject({ alt: '川', title: '川', label: '川' })
  })

  it('labels an untitled image with its alt text and shows no caption', () => {
    const thumb = thumbnailAttributes({ ...image, title: undefined, alt: 'A river' }, 'en', '50vw')
    expect(thumb).toMatchObject({ alt: 'A river', title: '', label: 'A river', sizes: '50vw' })
  })
})
