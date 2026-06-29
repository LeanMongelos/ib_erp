import { Header } from '@/components/layout/Header'
import { Suspense } from 'react'
import { FletesManager } from '@/components/fletes/FletesManager'
import { requirePagePermission } from '@/lib/page-guard'
import { listarFletes } from '@/lib/fletes/crud'
import { plain } from '@/lib/serialize'

export default async function FletesPage() {
  await requirePagePermission('fletes.read')

  const fletes = await listarFletes({ take: 300 })
  const inicial = JSON.parse(JSON.stringify(plain(fletes)))

  return (
    <>
      <Header
        title="Fletes"
        subtitle="Seguimiento de envíos entrantes y salientes — grilla AT-Fletes"
      />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <Suspense fallback={<p className="text-[12.5px] text-[#9aa1ab]">Cargando fletes…</p>}>
          <FletesManager inicial={inicial} />
        </Suspense>
      </div>
    </>
  )
}
