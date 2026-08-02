import { describe, expect, it } from 'vitest'
import {
  resolveRollEdge,
  resolveSlideEdge,
  resolveTransition,
  rollClip,
  slideTransform,
  spinTransform,
  tileRanks,
  transitionDefaultDuration,
} from './transitions.js'
import type { SlideEdge, TransitionKind } from './types.js'

describe('resolveTransition', () => {
  it('defaults to pop with its default duration', () => {
    const t = resolveTransition()
    expect(t.kind).toBe('pop')
    expect(t.duration).toBe(transitionDefaultDuration.pop)
  })

  it('applies per-kind default durations', () => {
    for (const kind of Object.keys(transitionDefaultDuration) as TransitionKind[]) {
      expect(resolveTransition(kind).duration).toBe(transitionDefaultDuration[kind])
    }
  })

  it('honours an explicit duration and clamps negatives to zero', () => {
    expect(resolveTransition({ kind: 'fade', duration: 1200 }).duration).toBe(1200)
    expect(resolveTransition({ kind: 'fade', duration: -50 }).duration).toBe(0)
  })

  it('collapses to a default-speed fade under reduced motion', () => {
    const t = resolveTransition({ kind: 'slide', duration: 900 }, true)
    expect(t.kind).toBe('fade')
    expect(t.duration).toBe(transitionDefaultDuration.fade)
  })

  it('clamps and rounds the tile grid', () => {
    const t = resolveTransition({ kind: 'draw', cols: 0, rows: 2.6 })
    expect(t.cols).toBe(1)
    expect(t.rows).toBe(3)
  })

  it('derives the stagger from duration, tile duration and count', () => {
    const t = resolveTransition({ kind: 'draw', duration: 1000, cols: 2, rows: 2 })
    expect(t.tileDuration).toBe(260)
    expect(t.stagger).toBeCloseTo((1000 - 260) / 3)
  })

  it('caps the tile duration at the total duration', () => {
    const t = resolveTransition({ kind: 'draw', duration: 100 })
    expect(t.tileDuration).toBe(100)
  })

  it('fills in the directional defaults', () => {
    const t = resolveTransition('slide')
    expect(t.slideFrom).toBe('top')
    expect(t.slideTo).toBe('bottom')
    expect(t.tileEffect).toBe('fade')
    expect(t.tileOrder).toBe('random')
  })
})

describe('tileRanks', () => {
  it('sequential is reading order', () => {
    expect(tileRanks('sequential', 3, 2)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('snake reverses every other row', () => {
    expect(tileRanks('snake', 3, 2)).toEqual([0, 1, 2, 5, 4, 3])
  })

  it('diagonal sweeps in anti-diagonal bands from the top-left', () => {
    expect(tileRanks('diagonal', 3, 2)).toEqual([0, 1, 3, 2, 4, 5])
  })

  it('random is a permutation of every rank', () => {
    const ranks = tileRanks('random', 5, 4)
    expect([...ranks].sort((a, b) => a - b)).toEqual([...Array(20).keys()])
  })
})

describe('edge resolution', () => {
  it('passes concrete edges through', () => {
    expect(resolveSlideEdge('bottom-left')).toBe('bottom-left')
  })

  it('random resolves to a known edge or corner', () => {
    const edges = new Set<SlideEdge>([
      'top',
      'bottom',
      'left',
      'right',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ])
    for (let i = 0; i < 50; i++) {
      expect(edges.has(resolveSlideEdge('random'))).toBe(true)
    }
  })

  it('roll coerces corners to their vertical edge', () => {
    expect(resolveRollEdge('top-left')).toBe('top')
    expect(resolveRollEdge('top-right')).toBe('top')
    expect(resolveRollEdge('bottom-left')).toBe('bottom')
    expect(resolveRollEdge('bottom-right')).toBe('bottom')
    expect(resolveRollEdge('left')).toBe('left')
  })

  it('roll random resolves to a straight edge only', () => {
    for (let i = 0; i < 50; i++) {
      expect(['top', 'bottom', 'left', 'right']).toContain(resolveRollEdge('random'))
    }
  })
})

describe('transforms and clips', () => {
  it('slide transforms move fully off-screen', () => {
    expect(slideTransform('left')).toBe('translateX(-100vw)')
    expect(slideTransform('bottom-right')).toBe('translate(100vw, 100vh)')
  })

  it('spin adds a rotation whose sign follows the travel direction', () => {
    expect(spinTransform('left')).toContain('rotate(-360deg)')
    expect(spinTransform('right')).toContain('rotate(360deg)')
    expect(spinTransform('top-left')).toContain('rotate(-360deg)')
  })

  it('roll clips hide everything except the entry edge', () => {
    expect(rollClip('top')).toBe('inset(0 0 100% 0)')
    expect(rollClip('left')).toBe('inset(0 100% 0 0)')
  })
})
