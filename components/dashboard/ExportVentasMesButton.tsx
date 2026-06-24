'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExportVentasMesButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open('/api/reportes/ventas-mes', '_blank')}
    >
      <Download size={14} />
      Exportar ventas CSV
    </Button>
  )
}
