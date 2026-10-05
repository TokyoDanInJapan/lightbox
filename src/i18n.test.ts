import { describe, expect, it } from 'vitest'
import { formatCounter, getUIStrings, resolveText } from './i18n.js'

describe('resolveText', () => {
  it('passes plain strings through', () => {
    expect(resolveText('River', 'ja')).toBe('River')
  })

  it('picks the requested locale from a map', () => {
    expect(resolveText({ en: 'River', ja: '川' }, 'ja')).toBe('川')
  })

  it('falls back to English when the locale is missing', () => {
    expect(resolveText({ en: 'River', ja: '川' }, 'fr')).toBe('River')
  })

  it('falls back to the first value when English is missing too', () => {
    expect(resolveText({ ja: '川' }, 'fr')).toBe('川')
  })

  it('reads a regional locale as its language', () => {
    expect(resolveText({ en: 'River', ja: '川' }, 'ja-JP')).toBe('川')
  })

  it('prefers the exact regional text when there is some', () => {
    expect(resolveText({ en: 'Colour', 'en-US': 'Color' }, 'en-US')).toBe('Color')
  })

  it('returns an empty string for undefined', () => {
    expect(resolveText(undefined, 'en')).toBe('')
  })
})

describe('getUIStrings', () => {
  it('has built-in Japanese strings', () => {
    expect(getUIStrings('ja').close).toBe('閉じる')
  })

  it('falls back to English for unknown locales', () => {
    expect(getUIStrings('fr').close).toBe('Close')
  })

  it("uses the built-in strings of a regional locale's language", () => {
    expect(getUIStrings('ja-JP').close).toBe('閉じる')
  })

  it('applies language-wide overrides, then regional ones', () => {
    const strings = getUIStrings('fr-CA', {
      fr: { close: 'Fermer', next: 'Image suivante' },
      'fr-CA': { close: 'Fermer ici' },
    })
    expect(strings.close).toBe('Fermer ici')
    expect(strings.next).toBe('Image suivante')
  })

  it('merges per-locale overrides over the built-ins', () => {
    const strings = getUIStrings('fr', { fr: { close: 'Fermer' } })
    expect(strings.close).toBe('Fermer')
    expect(strings.next).toBe('Next image')
  })
})

describe('formatCounter', () => {
  it('substitutes both placeholders', () => {
    expect(formatCounter('Image {current} of {total}', 2, 6)).toBe('Image 2 of 6')
    expect(formatCounter('{total}枚中{current}枚目', 2, 6)).toBe('6枚中2枚目')
  })

  it('substitutes a placeholder used more than once', () => {
    expect(formatCounter('{current}/{total} ({current})', 2, 6)).toBe('2/6 (2)')
  })
})
