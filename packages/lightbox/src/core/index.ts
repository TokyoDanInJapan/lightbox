// Framework-free entry point: everything here works without React.
export { createLightbox } from './lightbox'
export type { LightboxController, LightboxOptions } from './lightbox'
export { builtinUIStrings, resolveText } from '../i18n'
export { resolveTransition, transitionDefaultDuration } from '../transitions'
export type { ResolvedTransition } from '../transitions'
export { toSrcSet } from '../utils'
export type {
  GalleryImage,
  ImageSource,
  LocalizedText,
  SlideDirection,
  SlideEdge,
  ThemeSetting,
  TileEffect,
  TileOrder,
  TransitionConfig,
  TransitionKind,
  TransitionSetting,
  UIStrings,
} from '../types'
