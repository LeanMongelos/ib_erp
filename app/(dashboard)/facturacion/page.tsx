import { Header } from '@/components/layout/Header'
import { FacturasTable } from '@/components/facturacion/FacturasTable'
import { prisma } from '@/lib/prisma'
import { formatMonto } from '@/lib/utils'
import { plain } from '@/lib/serialize'
import { requirePagePermission } from '@/lib/page-guard'

async function getFacturas() {
  return prisma.factura.findMany({
    orderBy: { creadoEn: 'desc' },
    include: {
      cliente: { select: { nombre: true } },
      vencimientos: { orderBy: { numeroCuota: 'asc' } },
    },
  })
}

export default async function FacturacionPage() {
  await requirePagePermission('facturas.read')
  const facturas = await getFacturas()

  const totalFacturado = facturas.reduce((acc, f) => acc + Number(f.total), 0)
  const totalCobrado   = facturas.filter((f) => f.estado === 'PAGADA').reduce((acc, f) => acc + Number(f.total), 0)
  const totalPendiente = facturas.filter((f) => f.estado === 'PENDIENTE' || f.estado === 'VENCIDA').reduce((acc, f) => acc + Number(f.total), 0)

  return (
    <>
      <Header title="Facturación" subtitle="Comprobantes · Junio 2026" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        {/* Resumen financiero */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Total facturado', monto: totalFacturado,  color: 'text-[#16181d]' },
            { label: 'Total cobrado',   monto: totalCobrado,    color: 'text-[#15803D]' },
            { label: 'Pendiente',       monto: totalPendiente,  color: 'text-[#C2261B]' },
          ].map(({ label, monto, color }) => (
            <div key={label} className="bg-white border border-[#edeef1] rounded-[11px] p-4 shadow-card">
              <p className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-1.5">{label}</p>
              <p className={`text-[24px] font-extrabold tracking-tight ${color}`}>{formatMonto(monto)}</p>
            </div>
          ))}
        </div>

        <FacturasTable facturas={plain(facturas)} />
      </div>
    </>
  )
}
