/** A string, or a map of locale code to string, for example `{ en: 'River', ja: '川' }`. */
export type LocalizedText = string | Record<string, string>

export interface ImageSource {
  /** URL of the image at this resolution. */
  src: string
  /** Intrinsic pixel width of this resolution, used for the srcset `w` descriptor. */
  width: number
}

export interface GalleryImage {
  /** Stable key; falls back to array index. */
  id?: string
  /** Available resolutions of the full image, in any order. Must contain at least one entry. */
  sources: ImageSource[]
  /** Optional dedicated thumbnail resolutions; falls back to `sources`. */
  thumbnailSources?: ImageSource[]
  /** Natural pixel width of the full-size image (for aspect-ratio layout). */
  width: number
  /** Natural pixel height of the full-size image. */
  height: number
  alt?: LocalizedText
  title?: LocalizedText
  description?: LocalizedText
  /**
   * `sizes` attribute for the full-size image. Defaults to the width the
   * default stylesheet gives the stage. Set this when your own CSS overrides
   * `--lb-stage-max-w` / `--lb-stage-max-h`, so the browser is told the width
   * it actually draws rather than over-fetching.
   */
  sizes?: string
}

export type TransitionKind = 'pop' | 'fade' | 'slide' | 'draw' | 'spin' | 'roll'

/** How each tile of the 'draw' transition animates into place. */
export type TileEffect = 'pop' | 'fade' | 'slide' | 'spin'

/**
 * Order in which the 'draw' tiles appear: shuffled, reading order
 * (top-left to bottom-right), a snake that reverses direction on each row,
 * or a diagonal sweep from the top-left corner to the bottom-right.
 */
export type TileOrder = 'random' | 'sequential' | 'snake' | 'diagonal'

export type SlideEdge =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

/** An edge or corner, or 'random' to pick one (per tile for the draw effect). */
export type SlideDirection = SlideEdge | 'random'

export interface TransitionConfig {
  kind: TransitionKind
  /**
   * Total open/close animation time in ms. For 'draw' this is the time until
   * the last tile has finished appearing. Defaults per kind:
   * pop 300, fade 260, slide 440, draw 760, spin 600, roll 700.
   */
  duration?: number
  /** 'draw' only: number of tile columns. Default 5. */
  cols?: number
  /** 'draw' only: number of tile rows. Default 4. */
  rows?: number
  /** 'draw' only: fade time of an individual tile in ms. Default 260. */
  tileDuration?: number
  /**
   * 'draw' only: how each tile arrives — 'fade' (default), 'pop' (scales up
   * into place), 'slide' (enters from `slideFrom`, leaves via `slideTo`) or
   * 'spin' (as slide, but rotating).
   */
  tileEffect?: TileEffect
  /** 'draw' only: the order tiles appear in. Default 'random'. */
  tileOrder?: TileOrder
  /**
   * 'slide'/'spin' kinds and 'draw' with tileEffect 'slide' or 'spin': the
   * screen edge or corner the image (or each tile) travels in from. For
   * 'roll', the edge the image unrolls from (corners coerce to top/bottom).
   * 'random' picks one at random — independently per tile for draw.
   * Default 'top'.
   */
  slideFrom?: SlideDirection
  /**
   * As `slideFrom`, but the edge it leaves through on close. Default
   * 'bottom'. Ignored by 'roll', which always rolls back up towards its
   * `slideFrom` edge.
   */
  slideTo?: SlideDirection
}

/** Either a transition kind with default settings, or a full config object. */
export type TransitionSetting = TransitionKind | TransitionConfig

export type ThemeSetting = 'light' | 'dark' | 'auto'

export interface UIStrings {
  dialogLabel: string
  close: string
  next: string
  previous: string
  /** Template with `{current}` and `{total}` placeholders. */
  counter: string
}
