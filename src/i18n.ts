import type { LocalizedText, UIStrings } from './types.js'

export const builtinUIStrings: Record<string, UIStrings> = {
  en: {
    dialogLabel: 'Image viewer',
    close: 'Close',
    next: 'Next image',
    previous: 'Previous image',
    counter: 'Image {current} of {total}',
  },
  ja: {
    dialogLabel: '画像ビューア',
    close: '閉じる',
    next: '次の画像',
    previous: '前の画像',
    counter: '{total}枚中{current}枚目',
  },
}

/**
 * The keys to try for a locale, most specific first: 'ja-JP' gives
 * ['ja-JP', 'ja'], so a regional tag such as `navigator.language` returns
 * still finds text written for the language as a whole.
 */
function localeChain(locale: string): string[] {
  const language = locale.split('-')[0]
  return language && language !== locale ? [locale, language] : [locale]
}

/**
 * Resolve a LocalizedText for a locale, falling back to the locale's base
 * language, then to English, then to any value.
 */
export function resolveText(text: LocalizedText | undefined, locale: string): string {
  if (text == null) return ''
  if (typeof text === 'string') return text
  for (const key of localeChain(locale)) {
    if (text[key] != null) return text[key]
  }
  return text.en ?? Object.values(text)[0] ?? ''
}

export function getUIStrings(
  locale: string,
  overrides?: Partial<Record<string, Partial<UIStrings>>>,
): UIStrings {
  const chain = localeChain(locale)
  const base = chain.map((key) => builtinUIStrings[key]).find(Boolean) ?? builtinUIStrings.en
  // Language-wide overrides first, so a regional one can refine them.
  return Object.assign({}, base, ...[...chain].reverse().map((key) => overrides?.[key]))
}

export function formatCounter(template: string, current: number, total: number): string {
  return template.replace(/\{current\}/g, String(current)).replace(/\{total\}/g, String(total))
}
