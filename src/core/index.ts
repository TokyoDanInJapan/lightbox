// Framework-free entry point: everything here works without React.
export { createLightbox } from './lightbox.js'
export type { LightboxController, LightboxOptions, LightboxUpdate } from './lightbox.js'
export { builtinUIStrings, resolveText } from '../i18n.js'
export { defaultThumbnailSizes, thumbnailAttributes } from '../thumbnail.js'
export type { ThumbnailAttributes } from '../thumbnail.js'
export { resolveTransition, transitionDefaultDuration } from '../transitions.js'
export type { ResolvedTransition } from '../transitions.js'
export { defaultSizes, toSrcSet } from '../utils.js'
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
