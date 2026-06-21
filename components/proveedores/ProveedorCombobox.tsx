'use client'

import { Combobox, type ComboboxOption } from '@/components/ui/combobox'

export interface ProveedorOption {
  id: string
  razonSocial: string
  rubro?: string | null
}

interface Props {
  value: string
  onChange: (proveedorId: string) => void
  initialOptions?: ProveedorOption[]
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

function mapProveedores(data: unknown): ComboboxOption[] {
  if (!Array.isArray(data)) return []
  return data.map((p: ProveedorOption) => ({
    value: p.id,
    label: p.razonSocial,
    hint: p.rubro ?? undefined,
  }))
}

export function ProveedorCombobox({
  value,
  onChange,
  initialOptions = [],
  label = 'Proveedor',
  placeholder = 'Buscar proveedor…',
  disabled,
  className,
}: Props) {
  const staticOpts: ComboboxOption[] = initialOptions.map((p) => ({
    value: p.id,
    label: p.razonSocial,
    hint: p.rubro ?? undefined,
  }))

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={staticOpts}
      fetchUrl="/api/proveedores"
      mapResponse={mapProveedores}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}
