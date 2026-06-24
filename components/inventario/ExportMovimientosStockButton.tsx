'use client'

import { useMemo } from 'react'
import { format, startOfMonth } from 'date-fns'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ExportMovimientosStockButton() {
  const url = useMemo(() => {
    const desde = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const hasta = format(new Date(), 'yyyy-MM-dd')
    return `/api/reportes/movimientos-stock?desde=${desde}&hasta=${hasta}`
  }, [])

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.open(url, '_blank')}
    >
      <Download size={14} />
      Exportar movimientos CSV
    </Button>
  )
}
