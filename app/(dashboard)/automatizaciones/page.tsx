import { Header } from '@/components/layout/Header'
import { ExternalLink, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function AutomatizacionesPage() {
  return (
    <>
      <Header title="Automatizaciones" subtitle="n8n · Workflows conectados" />
      <div className="flex-1 overflow-y-auto bg-[#F4F6F9] p-6">
        <Card className="max-w-2xl mx-auto text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-[#FFF1E2] flex items-center justify-center mx-auto mb-5">
            <Zap size={28} className="text-[#E8650A]" />
          </div>
          <h2 className="text-[18px] font-bold text-[#16181d] mb-2">Motor de automatizaciones n8n</h2>
          <p className="text-[13px] text-[#7c828c] mb-6 leading-relaxed">
            Las automatizaciones corren en n8n self-hosted.<br />
            Configurá workflows para alertas de SLA, emails automáticos y más.
          </p>
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#E8650A] text-white font-bold text-[13.5px] px-5 py-3 rounded-[9px] hover:bg-[#C4540A] transition-colors shadow-primary"
          >
            <ExternalLink size={16} />
            Abrir n8n Dashboard
          </a>
          <p className="text-[11.5px] text-[#9aa1ab] mt-4">
            Las credenciales de n8n se gestionan en el servidor — consultá al administrador.
          </p>
        </Card>
      </div>
    </>
  )
}
