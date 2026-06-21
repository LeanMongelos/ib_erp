import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label?: string }
  variant?: 'orange' | 'blue' | 'green' | 'red'
}

const iconBg: Record<string, string> = {
  orange: 'bg-[#FFF1E2]',
  blue:   'bg-blue-50',
  green:  'bg-green-50',
  red:    'bg-red-50',
}

const iconColor: Record<string, string> = {
  orange: 'text-[#E8650A]',
  blue:   'text-blue-600',
  green:  'text-green-600',
  red:    'text-red-600',
}

export function KPICard({ title, value, icon: Icon, trend, variant = 'orange' }: KPICardProps) {
  const isPositive = (trend?.value ?? 0) > 0
  const isNeutral  = (trend?.value ?? 0) === 0

  return (
    <div className="bg-white border border-[#edeef1] rounded-[11px] p-[17px] shadow-card animate-fade-in">
      <div className="flex items-center justify-between">
        {/* Ícono */}
        <div className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center', iconBg[variant])}>
          <Icon size={20} strokeWidth={1.8} className={iconColor[variant]} />
        </div>

        {/* Trend badge */}
        {trend !== undefined && (
          <span
            className={cn(
              'text-[11px] font-bold px-2 py-1 rounded-[6px] flex items-center gap-1',
              isNeutral  && 'bg-gray-100 text-gray-500',
              isPositive && variant === 'red'
                ? 'bg-red-50 text-red-600'
                : isPositive
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600',
            )}
          >
            {isNeutral ? <Minus size={11} /> : isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend.value)}
          </span>
        )}
      </div>

      <p className="text-[30px] font-extrabold text-[#16181d] mt-3 tracking-tight leading-none">
        {value}
      </p>
      <p className="text-[12px] text-[#7c828c] font-medium mt-1">{title}</p>
    </div>
  )
}
