'use client'

import { Bell } from 'lucide-react'
import { NotificationInboxBase } from '@/components/layout/NotificationInboxBase'

export function NotificationBell() {
  return (
    <NotificationInboxBase
      scope="general"
      icon={Bell}
      ariaLabel="Notificaciones"
      panelTitle="Notificaciones"
      emptyTitle="Sin alertas pendientes"
      emptyHint="Cobranzas, OT, preventivos y stock se monitorean en vivo."
      footerHref="/configuracion/notificaciones"
      footerLabel="Configurar reglas de aviso"
    />
  )
}
