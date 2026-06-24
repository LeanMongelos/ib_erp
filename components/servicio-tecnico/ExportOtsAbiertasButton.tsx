'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExportOtsAbiertasButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open('/api/reportes/ots-abiertas', '_blank')}
    >
      <Download size={14} />
      Exportar OTs CSV
    </Button>
  )
}
