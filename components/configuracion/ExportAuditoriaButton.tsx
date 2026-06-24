'use client'

import { useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ExportAuditoriaButton() {
  const [desde, setDesde] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [hasta, setHasta] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  function exportar() {
    if (!desde || !hasta) {
      toast.error('Indicá fecha desde y hasta')
      return
    }
    if (desde > hasta) {
      toast.error('"Desde" no puede ser posterior a "Hasta"')
      return
    }
    window.open(
      `/api/reportes/auditoria?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      '_blank',
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        label="Desde"
        type="date"
        value={desde}
        onChange={(e) => setDesde(e.target.value)}
        className="w-40"
      />
      <Input
        label="Hasta"
        type="date"
        value={hasta}
        onChange={(e) => setHasta(e.target.value)}
        className="w-40"
      />
      <Button variant="outline" size="sm" onClick={exportar}>
        <Download size={14} className="mr-1.5" />
        Exportar CSV
      </Button>
    </div>
  )
}
