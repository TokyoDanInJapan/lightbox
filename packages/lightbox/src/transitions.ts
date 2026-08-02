import type {
  SlideDirection,
  SlideEdge,
  TileEffect,
  TileOrder,
  TransitionConfig,
  TransitionKind,
  TransitionSetting,
} from './types'

export const transitionDefaultDuration: Record<TransitionKind, number> = {
  pop: 300,
  fade: 260,
  slide: 440,
  draw: 760,
  spin: 600,
  roll: 700,
}

export interface ResolvedTransition {
  kind: TransitionKind
  /** Total open/close animation time in ms. */
  duration: number
  cols: number
  rows: number
  tileDuration: number
  tileEffect: TileEffect
  tileOrder: TileOrder
  slideFrom: SlideDirection
  slideTo: SlideDirection
  /** Delay between successive tiles, derived from duration and tileDuration. */
  stagger: number
}

/**
 * Normalise a TransitionSetting to concrete values. When the user prefers
 * reduced motion the transition collapses to a default-speed fade.
 */
export function resolveTransition(
  setting: TransitionSetting = 'pop',
  reducedMotion = false,
): ResolvedTransition {
  const config: TransitionConfig =
    typeof setting === 'string' ? { kind: setting } : setting
  const kind = reducedMotion ? 'fade' : config.kind
  const duration = Math.max(
    0,
    reducedMotion
      ? transitionDefaultDuration.fade
      : config.duration ?? transitionDefaultDuration[kind],
  )
  const cols = Math.max(1, Math.round(config.cols ?? 5))
  const rows = Math.max(1, Math.round(config.rows ?? 4))
  const count = cols * rows
  const tileDuration = Math.max(0, Math.min(config.tileDuration ?? 260, duration))
  const stagger = count > 1 ? Math.max(0, (duration - tileDuration) / (count - 1)) : 0
  const tileEffect = config.tileEffect ?? 'fade'
  const tileOrder = config.tileOrder ?? 'random'
  const slideFrom = config.slideFrom ?? 'top'
  const slideTo = config.slideTo ?? 'bottom'
  return {
    kind,
    duration,
    cols,
    rows,
    tileDuration,
    tileEffect,
    tileOrder,
    slideFrom,
    slideTo,
    stagger,
  }
}

/**
 * Rank (0-based position in the reveal sequence) of each tile, indexed by
 * row-major tile index. 'random' shuffles; 'sequential' is reading order;
 * 'snake' reverses direction on every other row; 'diagonal' sweeps in
 * anti-diagonal bands from the top-left corner to the bottom-right.
 */
export function tileRanks(order: TileOrder, cols: number, rows: number): number[] {
  const count = cols * rows
  const ranks = new Array<number>(count)
  if (order === 'random') {
    const sequence = [...Array(count).keys()]
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[sequence[i], sequence[j]] = [sequence[j], sequence[i]]
    }
    sequence.forEach((tile, rank) => {
      ranks[tile] = rank
    })
  } else if (order === 'diagonal') {
    const sequence = [...Array(count).keys()].sort((a, b) => {
      const bandA = Math.floor(a / cols) + (a % cols)
      const bandB = Math.floor(b / cols) + (b % cols)
      return bandA - bandB || a - b
    })
    sequence.forEach((tile, rank) => {
      ranks[tile] = rank
    })
  } else {
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const flip = order === 'snake' && row % 2 === 1
      ranks[i] = row * cols + (flip ? cols - 1 - col : col)
    }
  }
  return ranks
}

const SLIDE_OFFSETS: Record<SlideEdge, string> = {
  top: 'translateY(-100vh)',
  bottom: 'translateY(100vh)',
  left: 'translateX(-100vw)',
  right: 'translateX(100vw)',
  'top-left': 'translate(-100vw, -100vh)',
  'top-right': 'translate(100vw, -100vh)',
  'bottom-left': 'translate(-100vw, 100vh)',
  'bottom-right': 'translate(100vw, 100vh)',
}

const SLIDE_EDGES = Object.keys(SLIDE_OFFSETS) as SlideEdge[]

/** Turn a SlideDirection into a concrete edge, picking one at random for 'random'. */
export function resolveSlideEdge(direction: SlideDirection): SlideEdge {
  if (direction !== 'random') return direction
  return SLIDE_EDGES[Math.floor(Math.random() * SLIDE_EDGES.length)]
}

/**
 * Transform that moves an element (the whole stage, or one draw tile) fully
 * off-screen past the given viewport edge or corner.
 */
export function slideTransform(edge: SlideEdge): string {
  return SLIDE_OFFSETS[edge]
}

/**
 * Full turn per edge, signed so the spin matches the travel direction like a
 * rolling object: entering from the left turns clockwise, from the right
 * counter-clockwise; vertical and diagonal edges follow their horizontal
 * component (top/bottom arbitrarily turn clockwise-down).
 */
const SPIN_ANGLES: Record<SlideEdge, number> = {
  top: -360,
  bottom: 360,
  left: -360,
  right: 360,
  'top-left': -360,
  'bottom-left': -360,
  'top-right': 360,
  'bottom-right': 360,
}

/** As slideTransform, but with a full rotation for the 'spin' transition. */
export function spinTransform(edge: SlideEdge): string {
  return `${SLIDE_OFFSETS[edge]} rotate(${SPIN_ANGLES[edge]}deg)`
}

/** The four straight edges the 'roll' transition can unroll from. */
export type RollEdge = 'top' | 'bottom' | 'left' | 'right'

/**
 * Resolve a direction to a roll edge: corners coerce to their vertical
 * component, 'random' picks one of the four straight edges.
 */
export function resolveRollEdge(direction: SlideDirection): RollEdge {
  if (direction === 'random') {
    const edges: RollEdge[] = ['top', 'bottom', 'left', 'right']
    return edges[Math.floor(Math.random() * edges.length)]
  }
  if (direction.startsWith('top')) return 'top'
  if (direction.startsWith('bottom')) return 'bottom'
  return direction as RollEdge
}

/** Clip that hides everything except the given edge, for the rolled-up state. */
const ROLL_CLIPS: Record<RollEdge, string> = {
  top: 'inset(0 0 100% 0)',
  bottom: 'inset(100% 0 0 0)',
  left: 'inset(0 100% 0 0)',
  right: 'inset(0 0 0 100%)',
}

export function rollClip(edge: RollEdge): string {
  return ROLL_CLIPS[edge]
}
