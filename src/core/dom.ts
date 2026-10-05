/** Create an element with an optional class list and CSS custom properties. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  vars?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      node.style.setProperty(name, value)
    }
  }
  return node
}

/**
 * Commit an element's current styles, so that a class added straight after
 * transitions from them. Reading layout forces the style calculation the
 * browser would otherwise put off to the next frame, which is what lets the
 * change happen now rather than two frames later.
 */
export function flushStyles(node: HTMLElement): void {
  void node.offsetWidth
}

/**
 * Resolve once an image is decoded and can be painted, or after `limit` ms,
 * whichever comes first. A broken or slow image still resolves, so a caller
 * waiting on it is never held up for longer than the limit.
 */
export function whenDecoded(img: HTMLImageElement, limit: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, limit)
    const done = () => {
      window.clearTimeout(timer)
      resolve()
    }
    img.decode().then(done, done)
  })
}

const ICONS = {
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
} as const

/** Create one of the overlay's icon buttons. */
export function iconButton(
  className: string,
  icon: keyof typeof ICONS,
  label: string,
): HTMLButtonElement {
  const button = el('button', className)
  button.type = 'button'
  button.setAttribute('aria-label', label)
  button.innerHTML = ICONS[icon]
  return button
}
