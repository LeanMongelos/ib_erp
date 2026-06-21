'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'ibiomedica.embudo.sidebarHidden'

function isEmbudoPath(pathname: string) {
  return pathname === '/crm/embudo' || pathname.startsWith('/crm/embudo/')
}

interface SidebarContextValue {
  isEmbudo: boolean
  sidebarHidden: boolean
  toggleSidebar: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isEmbudo = isEmbudoPath(pathname)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!isEmbudo) {
      setHidden(false)
      return
    }
    const saved = localStorage.getItem(STORAGE_KEY)
    setHidden(saved === null ? true : saved === 'true')
  }, [isEmbudo])

  const setSidebarHidden = useCallback(
    (value: boolean) => {
      setHidden(value)
      if (isEmbudo) localStorage.setItem(STORAGE_KEY, String(value))
    },
    [isEmbudo],
  )

  const toggleSidebar = useCallback(() => {
    setSidebarHidden(!hidden)
  }, [hidden, setSidebarHidden])

  const value = useMemo(
    () => ({
      isEmbudo,
      sidebarHidden: isEmbudo && hidden,
      toggleSidebar,
    }),
    [isEmbudo, hidden, toggleSidebar],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useEmbudoSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useEmbudoSidebar must be used within SidebarProvider')
  return ctx
}
