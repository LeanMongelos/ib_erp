'use client'

import { MessageCircle } from 'lucide-react'
import { NotificationInboxBase } from '@/components/layout/NotificationInboxBase'

export function CrmInboxBell() {
  return (
    <NotificationInboxBase
      scope="crm"
      icon={MessageCircle}
      ariaLabel="Mensajes CRM"
      panelTitle="Mensajes CRM"
      emptyTitle="Sin mensajes pendientes"
      emptyHint="Las conversaciones con mensajes sin leer aparecerán acá."
      badgeClassName="bg-[#0d6efd]"
      iconClassName="text-[#0d6efd]"
      footerHref="/crm/inbox"
      footerLabel="Ir a la bandeja CRM"
    />
  )
}
