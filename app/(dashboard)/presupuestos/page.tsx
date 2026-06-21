import { Header } from '@/components/layout/Header'
import { PresupuestosTable } from '@/components/presupuestos/PresupuestosTable'
import { prisma } from '@/lib/prisma'
import { formatMonto } from '@/lib/utils'
import { plain } from '@/lib/serialize'

export default async function PresupuestosPage() {
  const presupuestos = await prisma.presupuesto.findMany({
    orderBy: { creadoEn: 'desc' },
    include: { cliente: { select: { nombre: true } } },
  })

  const total = presupuestos.reduce((a, p) => a + Number(p.total), 0)
  const aprobados = presupuestos.filter((p) => p.estado === 'APROBADO').length
  const pendientes = presupuestos.filter((p) => ['BORRADOR', 'ENVIADO'].includes(p.estado)).length

  return (
    <>
      <Header title="Presupuestos" subtitle="Cotizaciones comerciales" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: 'Total cotizado', monto: total, color: 'text-[#16181d]' },
            { label: 'Aprobados', monto: aprobados, color: 'text-[#15803D]', isCount: true },
            { label: 'Pendientes', monto: pendientes, color: 'text-[#E8650A]', isCount: true },
          ].map(({ label, monto, color, isCount }) => (
            <div key={label} className="bg-white border border-[#edeef1] rounded-[11px] p-4 shadow-card">
              <p className="text-[11px] font-bold text-[#8a909a] uppercase tracking-wide mb-1.5">{label}</p>
              <p className={`text-[24px] font-extrabold tracking-tight ${color}`}>
                {isCount ? monto : formatMonto(monto)}
              </p>
            </div>
          ))}
        </div>
        <PresupuestosTable presupuestos={JSON.parse(JSON.stringify(plain(presupuestos)))} />
      </div>
    </>
  )
}
