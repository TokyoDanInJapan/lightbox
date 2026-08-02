/**
 * Prefix a site-absolute path with the base the demo is served from.
 *
 * Astro rewrites the paths it generates itself, but not the ones written by
 * hand in a link. The demo runs at the root in development and under
 * /lightbox/ on GitHub Pages, so its two cross-page links go through here.
 */
export function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}/${path}`.replace(/\/{2,}/g, '/')
}
