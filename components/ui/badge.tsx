import { cn } from '@/lib/utils'
import { type EstadoOT, type EstadoFactura } from '@/types'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'
}

const variants: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-orange-100 text-orange-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  gray:    'bg-gray-100 text-gray-500',
}

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function BadgeEstadoOT({ estado }: { estado: EstadoOT }) {
  const map: Record<EstadoOT, { variant: BadgeProps['variant']; label: string }> = {
    ABIERTA:    { variant: 'info',    label: 'Abierta' },
    EN_PROCESO: { variant: 'warning', label: 'En proceso' },
    CERRADA:    { variant: 'success', label: 'Cerrada' },
    VENCIDA:    { variant: 'danger',  label: 'Vencida' },
    CANCELADA:  { variant: 'gray',    label: 'Cancelada' },
  }
  const { variant, label } = map[estado] ?? { variant: 'gray', label: estado }
  return (
    <Badge variant={variant}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  )
}

export function BadgeTipoOT({ tipo }: { tipo: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    CORRECTIVO:  { variant: 'default', label: 'Correctivo' },
    PREVENTIVO:  { variant: 'info',    label: 'Preventivo' },
    INSTALACION: { variant: 'success', label: 'Instalación' },
    CALIBRACION: { variant: 'warning', label: 'Calibración' },
    GARANTIA:    { variant: 'gray',    label: 'Garantía' },
  }
  const { variant, label } = map[tipo] ?? { variant: 'gray', label: tipo }
  return <Badge variant={variant}>{label}</Badge>
}

export function BadgeEstadoFactura({ estado }: { estado: EstadoFactura }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    EMITIDA:        { variant: 'success', label: 'Emitida AFIP' },
    PAGADA:         { variant: 'success', label: 'Pagada' },
    PENDIENTE:      { variant: 'warning', label: 'Pendiente' },
    PENDIENTE_CAE:  { variant: 'warning', label: 'Pend. CAE' },
    RECHAZADA:      { variant: 'danger',  label: 'Rechazada' },
    VENCIDA:        { variant: 'danger',  label: 'Vencida' },
    BORRADOR:       { variant: 'gray',    label: 'Borrador' },
    ANULADA:        { variant: 'gray',    label: 'Anulada' },
  }
  const { variant, label } = map[estado] ?? { variant: 'gray', label: estado }
  return <Badge variant={variant}>{label}</Badge>
}

export function BadgeEstadoPresupuesto({ estado }: { estado: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    BORRADOR:   { variant: 'gray',    label: 'Borrador' },
    ENVIADO:    { variant: 'info',    label: 'Enviado' },
    APROBADO:   { variant: 'success', label: 'Aprobado' },
    RECHAZADO:  { variant: 'danger',  label: 'Rechazado' },
    VENCIDO:    { variant: 'warning', label: 'Vencido' },
    CONVERTIDO: { variant: 'success', label: 'Convertido' },
  }
  const { variant, label } = map[estado] ?? { variant: 'gray', label: estado }
  return <Badge variant={variant}>{label}</Badge>
}

export function BadgePrioridad({ prioridad }: { prioridad: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    URGENTE: { variant: 'danger',  label: 'Urgente' },
    ALTA:    { variant: 'warning', label: 'Alta' },
    NORMAL:  { variant: 'info',    label: 'Normal' },
    BAJA:    { variant: 'gray',    label: 'Baja' },
  }
  const { variant, label } = map[prioridad] ?? { variant: 'gray', label: prioridad }
  return <Badge variant={variant}>{label}</Badge>
}

export function BadgeTipoCliente({ tipo }: { tipo: string }) {
  return (
    <Badge className="bg-orange-50 text-orange-700">
      {tipo.charAt(0) + tipo.slice(1).toLowerCase()}
    </Badge>
  )
}
