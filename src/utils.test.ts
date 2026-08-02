import { describe, expect, it } from 'vitest'
import { largestSource, smallestSource, toSrcSet } from './utils.js'

const sources = [
  { src: '/img-960.jpg', width: 960 },
  { src: '/img-480.jpg', width: 480 },
  { src: '/img-1920.jpg', width: 1920 },
]

describe('toSrcSet', () => {
  it('sorts by width ascending and formats w descriptors', () => {
    expect(toSrcSet(sources)).toBe('/img-480.jpg 480w, /img-960.jpg 960w, /img-1920.jpg 1920w')
  })

  it('does not mutate its input', () => {
    const copy = [...sources]
    toSrcSet(sources)
    expect(sources).toEqual(copy)
  })
})

describe('largestSource / smallestSource', () => {
  it('picks the extremes regardless of order', () => {
    expect(largestSource(sources).width).toBe(1920)
    expect(smallestSource(sources).width).toBe(480)
  })

  it('handles a single source', () => {
    const single = [{ src: '/only.jpg', width: 100 }]
    expect(largestSource(single)).toBe(single[0])
    expect(smallestSource(single)).toBe(single[0])
  })
})
