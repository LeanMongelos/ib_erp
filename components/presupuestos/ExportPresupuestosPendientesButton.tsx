'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExportPresupuestosPendientesButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open('/api/reportes/presupuestos-pendientes', '_blank')}
    >
      <Download size={14} />
      Exportar presupuestos CSV
    </Button>
  )
}
