import { requirePagePermission } from '@/lib/page-guard'

export default async function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePagePermission('config.read')
  return children
}
