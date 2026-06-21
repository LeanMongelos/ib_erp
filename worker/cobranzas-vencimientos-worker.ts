/**
 * worker/cobranzas-vencimientos-worker.ts
 * Revisa vencimientos de cobranza y avisa a Guillermo y Lucas cuando llega cada plazo.
 */

import { procesarVencimientosDelDia } from '@/lib/cobranzas/procesar-vencimientos'

const INTERVAL_MS = Number(process.env.COBRANZA_POLL_MS ?? 3_600_000)

async function tick() {
  try {
    const { enviados, revisados } = await procesarVencimientosDelDia()
    if (revisados > 0) {
      console.log(`[cobranzas-worker] ${enviados}/${revisados} aviso(s) enviado(s)`)
    }
  } catch (err) {
    console.error('[cobranzas-worker]', err instanceof Error ? err.message : err)
  }
}

async function main() {
  console.log(`[cobranzas-worker] Iniciando revisión cada ${INTERVAL_MS / 1000}s…`)
  await tick()
  setInterval(tick, INTERVAL_MS)
}

main().catch(console.error)
