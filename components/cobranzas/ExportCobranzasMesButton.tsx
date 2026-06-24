'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExportCobranzasMesButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open('/api/reportes/cobranzas-mes', '_blank')}
    >
      <Download size={14} />
      Exportar cobranzas CSV
    </Button>
  )
}
