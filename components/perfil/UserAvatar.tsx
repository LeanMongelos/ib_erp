'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'US'
}

interface Props {
  name: string
  avatarUrl?: string | null
  size?: number
  className?: string
}

export function UserAvatar({ name, avatarUrl, size = 34, className }: Props) {
  const [broken, setBroken] = useState(false)
  const initials = initialsFromName(name)
  const showImage = Boolean(avatarUrl?.trim()) && !broken

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl!}
        alt={name}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className={cn('rounded-full object-cover flex-shrink-0', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-white font-bold flex-shrink-0',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg,#F0820A,#E8650A)',
        fontSize: Math.max(11, Math.round(size * 0.38)),
      }}
      aria-hidden={!name}
    >
      {initials}
    </div>
  )
}
