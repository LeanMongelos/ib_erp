'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function ConfigPageShell({
  backHref = '/configuracion',
  children,
}: {
  backHref?: string
  children: React.ReactNode
}) {
  return (
    <div className="max-w-5xl flex flex-col gap-4">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6b7280] hover:text-[#E8650A] w-fit">
        <ArrowLeft size={14} /> Volver a Configuración
      </Link>
      {children}
    </div>
  )
}
