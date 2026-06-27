import { Header } from '@/components/layout/Header'
import { TesoreriaManager } from '@/components/tesoreria/TesoreriaManager'
import { requirePagePermission } from '@/lib/page-guard'

export default async function TesoreriaPage() {
  await requirePagePermission('tesoreria.read')

  return (
    <>
      <Header title="Tesorería" subtitle="Cuentas banco y caja, movimientos y conciliación" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <TesoreriaManager />
      </div>
    </>
  )
}
