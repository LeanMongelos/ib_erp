'use client'

import { useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { ChevronDown, Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePermisos } from '@/components/auth/useCan'
import { AUDITORIA_EXPORT_PERMISSIONS } from '@/lib/page-permissions'
import { cn } from '@/lib/utils'

type ExportDef = {
  id: string
  titulo: string
  descripcion: string
  href: string
  permisos: string[]
}

const EXPORTES: ExportDef[] = [
  {
    id: 'iva-mes',
    titulo: 'IVA ventas del mes (por alícuota)',
    descripcion: 'Líneas de factura emitidas del mes con neto e IVA por alícuota.',
    href: '/api/reportes/iva-mes',
    permisos: ['facturas.read', 'reportes.read_fiscal'],
  },
  {
    id: 'aging-cobranzas',
    titulo: 'Aging de cobranzas',
    descripcion: 'Cuotas pendientes agrupadas por antigüedad (0-30, 31-60, 61-90, 90+ días).',
    href: '/api/reportes/aging-cobranzas',
    permisos: ['cobranzas.read', 'reportes.read_financiero'],
  },
  {
    id: 'ots-por-tecnico',
    titulo: 'OTs por técnico (mes)',
    descripcion: 'Órdenes abiertas y cerradas del mes agrupadas por técnico asignado.',
    href: '/api/reportes/ots-por-tecnico',
    permisos: ['servicio.read', 'reportes.read_operativo'],
  },
  {
    id: 'ventas-mes',
    titulo: 'Ventas del mes',
    descripcion: 'Facturas EMITIDA/PAGADA del mes en curso (número, cliente, totales, CAE).',
    href: '/api/reportes/ventas-mes',
    permisos: ['facturas.read', 'reportes.read_comercial'],
  },
  {
    id: 'cobranzas-mes',
    titulo: 'Cobranzas del mes',
    descripcion: 'Cuotas con vencimiento en el mes (factura, cliente, estado, montos).',
    href: '/api/reportes/cobranzas-mes',
    permisos: ['cobranzas.read', 'reportes.read_financiero'],
  },
  {
    id: 'ots-abiertas',
    titulo: 'OTs abiertas / en proceso',
    descripcion: 'Órdenes ABIERTA y EN_PROCESO con cliente, técnico, SLA y vencimiento.',
    href: '/api/reportes/ots-abiertas',
    permisos: ['servicio.read', 'reportes.read_operativo'],
  },
  {
    id: 'presupuestos-pendientes',
    titulo: 'Presupuestos pendientes',
    descripcion: 'Presupuestos ENVIADO/APROBADO con fecha de vencimiento y totales.',
    href: '/api/reportes/presupuestos-pendientes',
    permisos: ['presupuestos.read', 'reportes.read_comercial'],
  },
  {
    id: 'movimientos-stock',
    titulo: 'Movimientos de stock (kardex)',
    descripcion: 'Entradas, salidas y ajustes del mes en curso por producto y referencia.',
    href: '',
    permisos: ['inventario.read', 'reportes.read_operativo'],
  },
  {
    id: 'fiscal',
    titulo: 'Libro IVA / fiscal AFIP',
    descripcion: 'Comprobantes emitidos del mes con neto, IVA y CAE por emisor.',
    href: '/api/reportes/fiscal/export',
    permisos: ['reportes.read_fiscal'],
  },
  {
    id: 'auditoria',
    titulo: 'Auditoría del sistema',
    descripcion: 'Acciones registradas en el ERP (usuario, entidad, IP) por rango de fechas.',
    href: '',
    permisos: [...AUDITORIA_EXPORT_PERMISSIONS],
  },
]

function puedeExportar(userPermisos: string[], requeridos: string[]): boolean {
  if (userPermisos.includes('*')) return true
  return requeridos.some((p) => userPermisos.includes(p))
}

export function ReportesCsvCentro() {
  const userPermisos = usePermisos()
  const [abierto, setAbierto] = useState(false)
  const desde = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const hasta = format(new Date(), 'yyyy-MM-dd')

  const visibles = EXPORTES.filter((exp) => puedeExportar(userPermisos, exp.permisos))

  if (visibles.length === 0) return null

  function hrefExport(exp: ExportDef) {
    if (exp.id === 'movimientos-stock') {
      return `/api/reportes/movimientos-stock?desde=${desde}&hasta=${hasta}`
    }
    if (exp.id === 'auditoria') {
      return `/api/reportes/auditoria?desde=${desde}&hasta=${hasta}`
    }
    return exp.href
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-[#fafbfc] transition-colors rounded-[inherit]"
        aria-expanded={abierto}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet size={18} className="text-[#E8650A] shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#16181d]">Exportaciones CSV</p>
            <p className="text-[12px] text-[#7c828c] truncate">
              {visibles.length} reporte{visibles.length !== 1 ? 's' : ''} disponible
              {visibles.length !== 1 ? 's' : ''} · mes en curso
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn('text-[#9aa1ab] shrink-0 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="px-5 pb-5 pt-0 border-t border-[#edeef1]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-4">
            {visibles.map((exp) => (
              <div
                key={exp.id}
                className="flex items-start justify-between gap-2 p-2.5 rounded-[8px] bg-[#F4F6F9] border border-[#edeef1]"
                title={exp.descripcion}
              >
                <p className="text-[12px] font-semibold text-[#16181d] leading-snug line-clamp-2 min-w-0">
                  {exp.titulo}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-8 px-2.5"
                  onClick={() => window.open(hrefExport(exp), '_blank')}
                  title={exp.descripcion}
                >
                  <Download size={14} />
                  <span className="sr-only">Descargar {exp.titulo}</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
