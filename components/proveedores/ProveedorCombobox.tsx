'use client'

import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import type { TipoCompraProveedor } from '@/types'

export interface ProveedorOption {
  id: string
  razonSocial: string
  rubro?: string | null
  tipoCompra?: TipoCompraProveedor
}

interface Props {
  value: string
  onChange: (proveedorId: string) => void
  initialOptions?: ProveedorOption[]
  tipoCompraFilter?: TipoCompraProveedor
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

function filtrarOpciones(options: ProveedorOption[], tipo?: TipoCompraProveedor) {
  if (!tipo || tipo === 'AMBOS') return options
  return options.filter((p) => !p.tipoCompra || p.tipoCompra === tipo || p.tipoCompra === 'AMBOS')
}

export function ProveedorCombobox({
  value,
  onChange,
  initialOptions = [],
  tipoCompraFilter,
  label = 'Proveedor',
  placeholder = 'Buscar proveedor…',
  disabled,
  className,
}: Props) {
  const opcionesFiltradas = filtrarOpciones(initialOptions, tipoCompraFilter)
  const staticOpts: ComboboxOption[] = opcionesFiltradas.map((p) => ({
    value: p.id,
    label: p.razonSocial,
    hint: p.rubro ?? undefined,
  }))

  const fetchUrl = tipoCompraFilter && tipoCompraFilter !== 'AMBOS'
    ? `/api/proveedores?tipoCompra=${tipoCompraFilter}`
    : '/api/proveedores'

  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={staticOpts}
      fetchUrl={fetchUrl}
      mapResponse={mapProveedores}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}
