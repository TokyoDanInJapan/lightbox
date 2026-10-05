import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GalleryImage } from '../types.js'
import { Gallery, type GalleryProps } from './Gallery.js'

// Tell React this is a test environment, so act() flushes effects.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const image = (id: number): GalleryImage => ({
  id: String(id),
  sources: [{ src: `/img-${id}-960.jpg`, width: 960 }],
  width: 960,
  height: 640,
  title: { en: `Title ${id}`, ja: `題${id}` },
})

const overlay = () => document.querySelector<HTMLElement>('.lb-overlay')

let host: HTMLDivElement
let root: Root

const render = (props: GalleryProps) =>
  act(() => {
    root.render(<Gallery {...props} />)
  })

beforeEach(() => {
  document.body.innerHTML = ''
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
})

describe('Gallery', () => {
  it('renders a thumbnail button per image, the first few loading eagerly', async () => {
    await render({ images: [1, 2, 3].map(image), eagerThumbnails: 2 })
    const thumbs = host.querySelectorAll('.lb-thumb img')
    expect(thumbs).toHaveLength(3)
    expect([...thumbs].map((img) => img.getAttribute('loading'))).toEqual([
      'eager',
      'eager',
      'lazy',
    ])
    expect(host.querySelector('.lb-thumb')!.getAttribute('aria-label')).toBe('Title 1')
  })

  it('opens the lightbox at the clicked thumbnail', async () => {
    await render({ images: [1, 2, 3].map(image), transition: 'fade' })
    await act(() => host.querySelectorAll<HTMLElement>('.lb-thumb')[1].click())
    expect(overlay()!.querySelector('.lb-counter')!.textContent).toBe('Image 2 of 3')
  })

  it('keeps the overlay open when a re-render passes equal but fresh props', async () => {
    await render({ images: [1, 2].map(image), transition: { kind: 'fade' } })
    await act(() => host.querySelector<HTMLElement>('.lb-thumb')!.click())
    const open = overlay()
    await render({ images: [1, 2].map(image), transition: { kind: 'fade' } })
    expect(overlay()).toBe(open)
    expect(open!.isConnected).toBe(true)
  })

  it('changes the language of an open overlay in place', async () => {
    await render({ images: [1, 2].map(image), transition: 'fade' })
    await act(() => host.querySelector<HTMLElement>('.lb-thumb')!.click())
    const open = overlay()
    await render({ images: [1, 2].map(image), transition: 'fade', locale: 'ja' })
    expect(overlay()).toBe(open)
    expect(open!.querySelector('.lb-title')!.textContent).toBe('題1')
  })

  it('removes the overlay when it unmounts', async () => {
    await render({ images: [image(1)], transition: 'fade' })
    await act(() => host.querySelector<HTMLElement>('.lb-thumb')!.click())
    act(() => root.unmount())
    expect(overlay()).toBeNull()
    root = createRoot(host)
  })
})
