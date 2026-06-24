'use client'

import { useSession } from 'next-auth/react'

/** Campana Terminal: WARN técnicos — solo allowlist dev (ver lib/dev/alertas-dev). */
export function useDevAlertasUi(): boolean {
  const { data } = useSession()
  return data?.user?.devAlertasUi === true
}
