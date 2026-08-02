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
})
