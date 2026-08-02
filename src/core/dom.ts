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
 * Run a callback two animation frames from now, so styles committed in the
 * current frame are painted before a transition-triggering change. Returns a
 * cancel function.
 */
export function afterPaint(callback: () => void): () => void {
  let raf2 = 0
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(callback)
  })
  return () => {
    cancelAnimationFrame(raf1)
    cancelAnimationFrame(raf2)
  }
}

const ICONS = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
} as const

/** Create one of the overlay's icon buttons. */
export function iconButton(className: string, icon: keyof typeof ICONS, label: string): HTMLButtonElement {
  const button = el('button', className)
  button.type = 'button'
  button.setAttribute('aria-label', label)
  button.innerHTML = ICONS[icon]
  return button
}
