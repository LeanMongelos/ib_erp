'use client'

import { Combobox, type ComboboxOption } from '@/components/ui/combobox'

export interface ClienteOption {
  id: string
  nombre: string
  ciudad?: string | null
}

interface Props {
  value: string
  onChange: (clienteId: string) => void
  /** Opciones iniciales (p. ej. lista del servidor) para mostrar sin búsqueda */
  initialOptions?: ClienteOption[]
  label?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  className?: string
}

function mapClientes(data: unknown): ComboboxOption[] {
  if (!Array.isArray(data)) return []
  return data.map((c: ClienteOption) => ({
    value: c.id,
    label: c.nombre,
    hint: c.ciudad ?? undefined,
  }))
}

export function ClienteCombobox({
  value,
  onChange,
  initialOptions = [],
  label = 'Cliente',
  placeholder = 'Buscar cliente…',
  disabled,
  error,
  className,
}: Props) {
  const staticOpts: ComboboxOption[] = initialOptions.map((c) => ({
    value: c.id,
    label: c.nombre,
    hint: c.ciudad ?? undefined,
  }))

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={staticOpts}
      fetchUrl="/api/clientes"
      mapResponse={mapClientes}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      error={error}
      className={className}
    />
  )
}
