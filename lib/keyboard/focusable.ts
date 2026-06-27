/** Selectores de elementos enfocables para navegación por teclado. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function getFocusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null,
  )
}

export function isVisibleModalOverlay(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  return true
}

/** Overlays de modal visibles (fixed full-screen o data-modal-overlay). */
export function getVisibleModalOverlays(): HTMLElement[] {
  const candidates = new Set<HTMLElement>()
  document.querySelectorAll<HTMLElement>('[data-modal-overlay]').forEach((el) => candidates.add(el))
  document.querySelectorAll<HTMLElement>('div.fixed.inset-0').forEach((el) => candidates.add(el))
  return Array.from(candidates).filter(isVisibleModalOverlay).sort((a, b) => {
    const za = Number.parseInt(window.getComputedStyle(a).zIndex, 10) || 0
    const zb = Number.parseInt(window.getComputedStyle(b).zIndex, 10) || 0
    return za - zb
  })
}

export function getTopModalOverlay(): HTMLElement | null {
  const overlays = getVisibleModalOverlays()
  return overlays.length > 0 ? overlays[overlays.length - 1] : null
}

export function getModalPanel(overlay: HTMLElement): HTMLElement {
  return overlay.querySelector<HTMLElement>('[data-modal-panel]') ?? overlay
}

const CLOSE_LABELS = new Set(['cancelar', 'cerrar', 'volver', 'omitir'])

export function findModalCloseButton(overlay: HTMLElement): HTMLButtonElement | null {
  const buttons = overlay.querySelectorAll<HTMLButtonElement>('button[type="button"]')
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase() ?? ''
    if (CLOSE_LABELS.has(text) || text.startsWith('cerrar')) return btn
  }
  return buttons[0] ?? null
}
