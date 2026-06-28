import { requirePagePermission } from '@/lib/page-guard'
import { ConfiguracionPageClient } from '@/components/configuracion/ConfiguracionPageClient'

export default async function ConfiguracionPage() {
  await requirePagePermission('config.read')
  return <ConfiguracionPageClient />
}
