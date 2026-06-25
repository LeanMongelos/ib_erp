'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  MessageCircle, Camera, Globe, Mail, Zap, CheckCircle2,
  AlertCircle, Clock, ChevronRight, Copy, ExternalLink,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GUIAS_INTEGRACION } from '@/lib/integraciones/guides'
import { mensajeErrorDesconocido, mensajeErrorJson } from '@/lib/errores'

interface Canal {
  id: string
  tipo: string
  nombre: string
  activo: boolean
  estado: string
  config: Record<string, string>
  pasoCompletado: number
  webhookUrlSugerida: string | null
  totalPasos: number
  errorMensaje?: string | null
  oauthConectado?: boolean
}

const ICONOS: Record<string, typeof MessageCircle> = {
  WHATSAPP: MessageCircle,
  INSTAGRAM: Camera,
  FACEBOOK: Globe,
  EMAIL_IMAP: Mail,
  EMAIL_GRAPH: Mail,
  N8N: Zap,
}

const ESTADO_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'gray' }> = {
  CONECTADO: { label: 'Conectado', variant: 'success' },
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  ERROR: { label: 'Error', variant: 'danger' },
  NO_CONFIGURADO: { label: 'Sin configurar', variant: 'gray' },
}

const CAMPOS_POR_CANAL: Record<string, { key: string; label: string; type?: string; placeholder?: string }[]> = {
  WHATSAPP: [
    { key: 'phoneNumberId', label: 'Phone Number ID' },
    { key: 'businessAccountId', label: 'WhatsApp Business Account ID' },
    { key: 'accessToken', label: 'Access Token (permanente)', type: 'password' },
    { key: 'appSecret', label: 'App Secret (Meta)', type: 'password', placeholder: 'Dashboard → Configuración → Básica' },
    { key: 'verifyToken', label: 'Verify Token (webhook)', placeholder: 'token-secreto-ibiomedica' },
  ],
  INSTAGRAM: [
    { key: 'pageId', label: 'Facebook Page ID' },
    { key: 'instagramAccountId', label: 'Instagram Account ID' },
    { key: 'pageAccessToken', label: 'Page Access Token', type: 'password' },
    { key: 'appSecret', label: 'App Secret (Meta)', type: 'password' },
    { key: 'verifyToken', label: 'Verify Token' },
  ],
  FACEBOOK: [
    { key: 'pageId', label: 'Facebook Page ID' },
    { key: 'pageAccessToken', label: 'Page Access Token', type: 'password' },
    { key: 'appSecret', label: 'App Secret (Meta)', type: 'password' },
    { key: 'verifyToken', label: 'Verify Token' },
  ],
  EMAIL_IMAP: [
    { key: 'imapHost', label: 'Servidor IMAP', placeholder: 'imap-mail.outlook.com' },
    { key: 'imapPort', label: 'Puerto IMAP', placeholder: '993' },
    { key: 'imapUser', label: 'Usuario IMAP' },
    { key: 'imapPassword', label: 'Contraseña de app', type: 'password' },
    { key: 'smtpHost', label: 'Servidor SMTP', placeholder: 'smtp-mail.outlook.com' },
    { key: 'smtpPort', label: 'Puerto SMTP', placeholder: '587' },
    { key: 'smtpUser', label: 'Usuario SMTP', placeholder: 'Mismo email que IMAP' },
    { key: 'smtpPassword', label: 'Contraseña SMTP', type: 'password', placeholder: 'Misma contraseña de app' },
    { key: 'fromEmail', label: 'Email remitente' },
    { key: 'fromName', label: 'Nombre remitente', placeholder: 'Ingeniería Biomédica' },
  ],
  EMAIL_GRAPH: [
    { key: 'tenantId', label: 'Azure Tenant ID' },
    { key: 'clientId', label: 'Application (client) ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password' },
    { key: 'mailboxEmail', label: 'Buzón a monitorear' },
  ],
  N8N: [
    { key: 'baseUrl', label: 'URL del ERP', placeholder: 'https://erp.tudominio.com' },
    { key: 'apiKey', label: 'API Key integración', type: 'password' },
    { key: 'webhookUrlN8n', label: 'Webhook URL de n8n' },
  ],
}

export function IntegracionesPanel() {
  const [canales, setCanales] = useState<Canal[]>([])
  const [sel, setSel] = useState<string>('WHATSAPP')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [paso, setPaso] = useState(0)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setLoading(true)
    try {
      const data = await fetch('/api/integraciones/canales').then((r) => r.json())
      setCanales(data)
      const canal = data.find((c: Canal) => c.tipo === sel)
      if (canal) {
        setConfig(canal.config ?? {})
        setPaso(canal.pasoCompletado ?? 0)
      }
    } catch {
      toast.error('Error al cargar integraciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('graph') === 'ok') {
      toast.success('Microsoft 365 conectado correctamente')
      window.history.replaceState({}, '', '/configuracion/integraciones')
      cargar()
    } else if (params.get('graph') === 'error') {
      toast.error(params.get('msg') ?? 'Error al conectar Microsoft')
      window.history.replaceState({}, '', '/configuracion/integraciones')
    }
  }, [])

  function seleccionarCanal(tipo: string) {
    setSel(tipo)
    const canal = canales.find((c) => c.tipo === tipo)
    setConfig(canal?.config ?? {})
    setPaso(canal?.pasoCompletado ?? 0)
  }

  async function guardar(opts?: { probar?: boolean; activar?: boolean }) {
    setGuardando(true)
    try {
      const res = await fetch(`/api/integraciones/canales/${sel}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          pasoCompletado: paso,
          probarConexion: opts?.probar,
          activo: opts?.activar,
          estado: opts?.activar ? 'CONECTADO' : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo guardar la integración'))
      toast.success(opts?.probar ? 'Validación completada' : opts?.activar ? 'Canal activado' : 'Configuración guardada')
      cargar()
    } catch (e: unknown) {
      toast.error(mensajeErrorDesconocido(e, 'No se pudo guardar la integración'))
    } finally {
      setGuardando(false)
    }
  }

  const canalSel = canales.find((c) => c.tipo === sel)
  const guia = GUIAS_INTEGRACION[sel]
  const pasoGuia = guia?.pasos[paso]
  const campos = CAMPOS_POR_CANAL[sel] ?? []
  const Icon = ICONOS[sel] ?? Zap
  const st = ESTADO_BADGE[canalSel?.estado ?? 'NO_CONFIGURADO']

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Lista canales */}
      <div className="col-span-3 space-y-2">
        <p className="text-[11px] font-bold text-[#8a909a] uppercase px-1">Canales</p>
        {loading ? (
          <p className="text-[12px] text-[#9aa1ab] p-3">Cargando…</p>
        ) : (
          canales.map((c) => {
            const I = ICONOS[c.tipo] ?? Zap
            const eb = ESTADO_BADGE[c.estado] ?? ESTADO_BADGE.NO_CONFIGURADO
            return (
              <button
                key={c.tipo}
                type="button"
                onClick={() => seleccionarCanal(c.tipo)}
                className={`w-full text-left p-3 rounded-[10px] border transition-all ${
                  sel === c.tipo ? 'border-[#E8650A] bg-[#FFF8F2] shadow-sm' : 'border-[#edeef1] bg-white hover:border-[#d0d4da]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[8px] bg-[#FFF1E2] flex items-center justify-center">
                    <I size={18} className="text-[#E8650A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-bold text-[#1f242c] truncate">{c.nombre}</p>
                    <Badge variant={eb.variant} className="mt-1 text-[9px]">{eb.label}</Badge>
                  </div>
                  <ChevronRight size={14} className="text-[#ccc]" />
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Wizard */}
      <div className="col-span-9 space-y-4">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[10px] bg-[#FFF1E2] flex items-center justify-center">
                <Icon size={24} className="text-[#E8650A]" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-[#16181d]">{guia?.titulo ?? canalSel?.nombre}</h2>
                <p className="text-[12.5px] text-[#7c828c]">{guia?.subtitulo}</p>
              </div>
            </div>
            {canalSel && <Badge variant={st.variant}>{st.label}</Badge>}
          </div>

          {canalSel?.errorMensaje && (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
              <AlertCircle size={15} /> {canalSel.errorMensaje}
            </div>
          )}

          {/* Progreso pasos */}
          <div className="mt-5 flex gap-1 overflow-x-auto pb-1">
            {guia?.pasos.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPaso(i)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                  i === paso ? 'bg-[#E8650A] text-white border-[#E8650A]' :
                  i < paso ? 'bg-green-50 text-green-700 border-green-200' :
                  'bg-white text-[#6b7280] border-[#e4e7eb]'
                }`}
              >
                {i < paso ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                Paso {i + 1}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Instrucciones */}
          <Card>
            <h3 className="text-[13.5px] font-bold text-[#1f242c] mb-3">{pasoGuia?.titulo}</h3>
            <p className="text-[13px] text-[#5b626d] leading-relaxed">{pasoGuia?.descripcion}</p>
            {pasoGuia?.nota && (
              <p className="mt-3 text-[12px] text-[#9aa1ab] bg-[#f4f6f9] rounded-[8px] px-3 py-2">{pasoGuia.nota}</p>
            )}
            {pasoGuia?.link && (
              <a href={pasoGuia.link.href} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#E8650A] hover:underline">
                <ExternalLink size={14} /> {pasoGuia.link.label}
              </a>
            )}
            {guia?.docsUrl && (
              <a href={guia.docsUrl} target="_blank" rel="noopener noreferrer"
                className="mt-2 block text-[11.5px] text-[#4285F4] hover:underline">
                Documentación oficial →
              </a>
            )}

            {canalSel?.webhookUrlSugerida && pasoGuia?.campos?.includes('webhookUrl') && (
              <div className="mt-4 p-3 bg-[#f0f7ff] border border-[#bfdbfe] rounded-[9px]">
                <p className="text-[10.5px] font-bold text-[#1e40af] uppercase mb-1">URL Webhook (copiar en Meta)</p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-[#1e3a8a] break-all flex-1">{canalSel.webhookUrlSugerida}</code>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(canalSel.webhookUrlSugerida!); toast.success('Copiado') }}
                    className="text-[#1e40af] hover:text-[#E8650A]"><Copy size={14} /></button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <Button variant="secondary" size="sm" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={paso >= (guia?.pasos.length ?? 1) - 1}
                onClick={() => { setPaso((p) => p + 1); guardar() }}>Siguiente paso</Button>
            </div>
          </Card>

          {/* Credenciales */}
          <Card>
            <h3 className="text-[13.5px] font-bold text-[#1f242c] mb-3">Credenciales</h3>
            <p className="text-[11.5px] text-[#9aa1ab] mb-4">Se guardan cifradas en el servidor. Nunca se commitean al repo.</p>
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {campos.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-[#5b626d] uppercase">{f.label}</label>
                  <input
                    type={f.type ?? 'text'}
                    value={config[f.key] ?? ''}
                    placeholder={f.placeholder}
                    autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-1p-ignore={f.type === 'password' ? true : undefined}
                    data-lpignore="true"
                    onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                    className="border border-[#e4e7eb] rounded-[9px] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#E8650A]/30"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#f0f1f4]">
              <Button variant="outline" size="sm" onClick={() => guardar()} loading={guardando}>Guardar</Button>
              {sel === 'EMAIL_GRAPH' && (
                <a href="/api/integraciones/graph/authorize">
                  <Button variant="secondary" size="sm" type="button">
                    {canalSel?.oauthConectado ? 'Reconectar Microsoft' : 'Conectar con Microsoft'}
                  </Button>
                </a>
              )}
              <Button variant="secondary" size="sm" onClick={() => guardar({ probar: true })} loading={guardando}>Probar conexión</Button>
              <Button variant="primary" size="sm" onClick={() => guardar({ activar: true })} loading={guardando}>Activar canal</Button>
            </div>
            {sel === 'EMAIL_GRAPH' && (
              <p className="text-[11px] text-[#7c828c] mt-3">
                Redirect URI en Azure: <code className="text-[#1e40af]">{typeof window !== 'undefined' ? window.location.origin : ''}/api/integraciones/graph/callback</code>
              </p>
            )}
          </Card>
        </div>

        {/* API n8n */}
        {sel === 'N8N' && (
          <Card>
            <h3 className="text-[13.5px] font-bold text-[#1f242c] mb-2">Endpoints para n8n → ERP</h3>
            <div className="grid grid-cols-2 gap-2 text-[12px] font-mono">
              {[
                ['POST', '/api/n8n/responder', 'Enviar respuesta a conversación'],
                ['POST', '/api/n8n/etiquetar', 'Agregar etiqueta'],
                ['POST', '/api/n8n/crear-lead', 'Alta rápida de cliente'],
                ['POST', '/api/n8n/crear-ot', 'Crear orden de servicio'],
              ].map(([method, path, desc]) => (
                <div key={path} className="bg-[#f4f6f9] rounded-[8px] px-3 py-2">
                  <span className="text-[#E8650A] font-bold">{method}</span> {path}
                  <p className="text-[10.5px] text-[#9aa1ab] font-sans mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#7c828c] mt-3">
              Header: <code className="text-[#1e40af]">Authorization: Bearer &lt;apiKey&gt;</code>
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
