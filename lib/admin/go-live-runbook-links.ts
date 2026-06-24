import type { GoLiveItem } from '@/lib/admin/go-live-status'

const REPO_RUNBOOK =
  'https://github.com/LeanMongelos/ib_erp/blob/master/docs/RUNBOOK-PRODUCCION.md'

const CODIGO_ANCHOR: Record<string, string> = {
  emisores_vacio: 'antes-del-go-live',
  produccion_sin_certificados: 'dia-1--checklist-operador',
  listo_cambiar_a_produccion: 'antes-del-go-live',
  homologacion_sin_cert: 'antes-del-go-live',
  plantillas_notificacion_ausentes: 'antes-del-go-live',
  crm_n8n_parcial: 'crm-en-produccion-imap--graph--n8n',
  redis_ausente: 'workers-pm2',
  worker_no_pm2: 'workers-pm2',
  worker_offline: 'workers-pm2',
  worker_cobranzas_no_pm2: 'cron-en-produccion',
  worker_cobranzas_offline: 'cron-en-produccion',
  sin_destinatarios_alertas: 'dia-1--checklist-operador',
  smtp_ausente: 'email-factura-al-cliente',
}

const SECCION_ANCHOR: Record<string, string> = {
  emisores: 'dia-1--checklist-operador',
  alertas: 'dia-1--checklist-operador',
  worker: 'workers-pm2',
  worker_cobranzas: 'cron-en-produccion',
  crm: 'crm-en-produccion-imap--graph--n8n',
  seed: 'antes-del-go-live',
  entorno: 'antes-del-go-live',
}

export function runbookUrlForGoLiveItem(item: GoLiveItem): string | null {
  if (item.nivel === 'pass') return null
  const anchor =
    (item.codigo && CODIGO_ANCHOR[item.codigo]) ||
    SECCION_ANCHOR[item.seccion] ||
    null
  if (!anchor) return null
  return `${REPO_RUNBOOK}#${anchor}`
}
