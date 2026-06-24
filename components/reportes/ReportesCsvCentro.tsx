'use client'

import { format, startOfMonth } from 'date-fns'
import { Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { usePermisos } from '@/components/auth/useCan'
import { AUDITORIA_EXPORT_PERMISSIONS } from '@/lib/page-permissions'

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
  const desde = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const hasta = format(new Date(), 'yyyy-MM-dd')

  const visibles = EXPORTES.filter((exp) => puedeExportar(userPermisos, exp.permisos))

  if (visibles.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-[#E8650A]" />
          Centro de exportaciones CSV
        </CardTitle>
      </CardHeader>
      <ul className="px-5 pb-5 space-y-3">
        {visibles.map((exp) => {
          const href =
            exp.id === 'movimientos-stock'
              ? `/api/reportes/movimientos-stock?desde=${desde}&hasta=${hasta}`
              : exp.id === 'auditoria'
                ? `/api/reportes/auditoria?desde=${desde}&hasta=${hasta}`
                : exp.href

          return (
            <li
              key={exp.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-[9px] bg-[#F4F6F9] border border-[#edeef1]"
            >
              <div>
                <p className="text-[13px] font-semibold text-[#16181d]">{exp.titulo}</p>
                <p className="text-[12px] text-[#7c828c] mt-0.5">{exp.descripcion}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => window.open(href, '_blank')}
              >
                <Download size={14} className="mr-1.5" />
                Descargar CSV
              </Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
