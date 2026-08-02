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

/** Resolve a LocalizedText for a locale, falling back to English, then to any value. */
export function resolveText(text: LocalizedText | undefined, locale: string): string {
  if (text == null) return ''
  if (typeof text === 'string') return text
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? ''
}

export function getUIStrings(
  locale: string,
  overrides?: Partial<Record<string, Partial<UIStrings>>>,
): UIStrings {
  const base = builtinUIStrings[locale] ?? builtinUIStrings.en
  return { ...base, ...overrides?.[locale] }
}

export function formatCounter(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total))
}
