// Framework-free entry point: everything here works without React.
export { createLightbox } from './lightbox.js'
export type { LightboxController, LightboxOptions } from './lightbox.js'
export { builtinUIStrings, resolveText } from '../i18n.js'
export { resolveTransition, transitionDefaultDuration } from '../transitions.js'
export type { ResolvedTransition } from '../transitions.js'
export { toSrcSet } from '../utils.js'
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
} from '../types.js'
