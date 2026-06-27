'use client'

import { useEffect, useRef } from 'react'
import {
  findModalCloseButton,
  getFocusableElements,
  getModalPanel,
  getTopModalOverlay,
  getVisibleModalOverlays,
} from '@/lib/keyboard/focusable'

const AUTO_FOCUS_ATTR = 'data-kb-auto-focused'

function focusFirstField(overlay: HTMLElement) {
  if (overlay.getAttribute(AUTO_FOCUS_ATTR) === '1') return
  if (overlay.contains(document.activeElement)) {
    overlay.setAttribute(AUTO_FOCUS_ATTR, '1')
    return
  }
  const panel = getModalPanel(overlay)
  const focusable = getFocusableElements(panel)
  const first = focusable.find((el) => {
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  }) ?? focusable[0]
  if (first) {
    first.focus()
    overlay.setAttribute(AUTO_FOCUS_ATTR, '1')
  }
}

function resetAutoFocusFlags() {
  document.querySelectorAll(`[${AUTO_FOCUS_ATTR}="1"]`).forEach((el) => {
    el.removeAttribute(AUTO_FOCUS_ATTR)
  })
}

export function KeyboardNavProvider({ children }: { children: React.ReactNode }) {
  const overlayCountRef = useRef(0)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const overlay = getTopModalOverlay()
      if (!overlay) return

      const panel = getModalPanel(overlay)
      const focusable = getFocusableElements(panel)
      if (focusable.length === 0) return

      if (e.key === 'Escape') {
        const target = e.target as HTMLElement | null
        if (target?.getAttribute('role') === 'combobox' && target.getAttribute('aria-expanded') === 'true') return
        const closeBtn = findModalCloseButton(overlay)
        if (closeBtn) {
          e.preventDefault()
          closeBtn.click()
        }
        return
      }

      if (e.key !== 'Tab') return
      if (!overlay.contains(document.activeElement)) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    function onMutations() {
      const overlays = getVisibleModalOverlays()
      if (overlays.length === 0) {
        resetAutoFocusFlags()
        overlayCountRef.current = 0
        return
      }
      if (overlays.length > overlayCountRef.current) {
        focusFirstField(overlays[overlays.length - 1])
      }
      overlayCountRef.current = overlays.length
    }

    document.addEventListener('keydown', onKeyDown, true)
    const observer = new MutationObserver(onMutations)
    observer.observe(document.body, { childList: true, subtree: true })
    onMutations()

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      observer.disconnect()
    }
  }, [])

  return <>{children}</>
}
