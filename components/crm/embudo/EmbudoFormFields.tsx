'use client'

import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { formatMontoMoneda } from '@/lib/moneda'
import { fieldVisible, type FormField } from '@/lib/crm/embudo-forms'
import { resolveAutoComplete } from '@/lib/form-autocomplete'
import styles from './embudo.module.css'

export interface EmbudoCatalogos {
  clientes: Array<{ id: string; nombre: string; ciudad?: string | null }>
  usuarios: Array<{ id: string; nombre: string; email?: string | null }>
}

function inicialesVendedor(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'OTRO'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function mapClientes(data: unknown): ComboboxOption[] {
  if (!Array.isArray(data)) return []
  return data.map((c: { id: string; nombre: string; ciudad?: string | null }) => ({
    value: c.id,
    label: c.nombre,
    hint: c.ciudad ?? undefined,
  }))
}

function mapInventario(data: unknown): ComboboxOption[] {
  if (!Array.isArray(data)) return []
  return data.map((i: { id: string; nombre: string; sku?: string | null; precioUnit?: number | null; moneda?: string | null }) => ({
    value: i.id,
    label: i.nombre,
    hint: [
      i.sku ? `SKU ${i.sku}` : null,
      i.precioUnit != null ? formatMontoMoneda(i.precioUnit, i.moneda ?? 'ARS') : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined,
  }))
}

export interface EmbudoNegocioContext {
  clienteId?: string | null
  presupuestoId?: string | null
}

export function renderEmbudoField(
  f: FormField,
  values: Record<string, unknown>,
  setField: (name: string, value: unknown) => void,
  catalogos?: EmbudoCatalogos,
  inventarioPrecios?: React.MutableRefObject<Map<string, number>>,
  negocioContext?: EmbudoNegocioContext,
) {
  if (!fieldVisible(f, values)) return null
  const cls = `${styles.formField} ${f.type === 'textarea' || f.type === 'checkbox-group' || f.type === 'radio' || f.type === 'cliente' || f.type === 'inventario' || f.type === 'usuario' ? styles.formFieldFull : ''}`
  const autoComplete = f.autoComplete ?? resolveAutoComplete(f.name, f.type === 'email' ? 'email' : f.type)

  if (f.type === 'cliente') {
    const idKey = `${f.name}Id`
    const idVal = String(values[idKey] ?? '')
    const textVal = String(values[f.name] ?? '')
    const pinned: ComboboxOption[] = []
    if (idVal && textVal) pinned.push({ value: idVal, label: textVal })
    const staticOpts = [
      ...pinned,
      ...(catalogos?.clientes ?? [])
        .filter((c) => c.id !== idVal)
        .map((c) => ({ value: c.id, label: c.nombre, hint: c.ciudad ?? undefined })),
    ]

    return (
      <div key={f.name} className={cls}>
        <Combobox
          label={`${f.label}${f.required ? ' *' : ''}`}
          value={idVal || textVal}
          onChange={(v, opt) => {
            if (opt) {
              setField(idKey, opt.value)
              setField(f.name, opt.label)
            } else {
              setField(idKey, '')
              setField(f.name, v)
            }
          }}
          options={staticOpts}
          fetchUrl="/api/clientes"
          mapResponse={mapClientes}
          placeholder="Buscar cliente del ERP…"
          allowCustom
          minSearchLength={1}
        />
      </div>
    )
  }

  if (f.type === 'inventario') {
    const idKey = 'inventarioId'
    const idVal = String(values[idKey] ?? '')
    const textVal = String(values[f.name] ?? '')
    const pinned: ComboboxOption[] = []
    if (idVal && textVal) pinned.push({ value: idVal, label: textVal })

    return (
      <div key={f.name} className={cls}>
        <Combobox
          label={`${f.label}${f.required ? ' *' : ''}`}
          value={idVal || textVal}
          onChange={(v, opt) => {
            if (opt) {
              setField(idKey, opt.value)
              setField(f.name, opt.label)
              const precio = inventarioPrecios?.current.get(opt.value)
              if (precio != null && precio > 0 && !values.monto) {
                setField('monto', precio)
              }
            } else {
              setField(idKey, '')
              setField(f.name, v)
            }
          }}
          options={pinned}
          fetchUrl="/api/inventario"
          mapResponse={(data) => {
            const opts = mapInventario(data)
            if (inventarioPrecios && Array.isArray(data)) {
              for (const i of data as Array<{ id: string; precioUnit?: number | null }>) {
                if (i.precioUnit != null) inventarioPrecios.current.set(i.id, Number(i.precioUnit))
              }
            }
            return opts
          }}
          placeholder="Buscar en inventario (nombre o SKU)…"
          allowCustom
          minSearchLength={2}
        />
      </div>
    )
  }

  if (f.type === 'usuario') {
    const usuarioOpts: ComboboxOption[] = (catalogos?.usuarios ?? []).map((u) => ({
      value: inicialesVendedor(u.nombre),
      label: u.nombre,
      hint: u.email ?? undefined,
    }))

    return (
      <div key={f.name} className={cls}>
        <Combobox
          label={`${f.label}${f.required ? ' *' : ''}`}
          value={String(values[f.name] ?? '')}
          onChange={(v) => setField(f.name, v)}
          options={usuarioOpts}
          placeholder="Seleccionar vendedor…"
          allowCustom={false}
        />
      </div>
    )
  }

  if (f.type === 'textarea') {
    return (
      <div key={f.name} className={cls}>
        <label className={styles.formLabel}>{f.label}{f.required ? ' *' : ''}</label>
        <textarea
          className={styles.formInput}
          rows={3}
          value={String(values[f.name] ?? '')}
          onChange={(e) => setField(f.name, e.target.value)}
          placeholder={f.placeholder}
          autoComplete={autoComplete}
        />
      </div>
    )
  }

  if (f.type === 'select') {
    return (
      <div key={f.name} className={cls}>
        <label className={styles.formLabel}>{f.label}{f.required ? ' *' : ''}</label>
        <select
          className={styles.formInput}
          value={String(values[f.name] ?? '')}
          onChange={(e) => setField(f.name, e.target.value)}
        >
          <option value="">— Seleccionar —</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    )
  }

  if (f.type === 'combobox') {
    return (
      <div key={f.name} className={cls}>
        <Combobox
          label={`${f.label}${f.required ? ' *' : ''}`}
          value={String(values[f.name] ?? '')}
          onChange={(v) => setField(f.name, v)}
          options={f.options?.map((o) => ({ value: o.value, label: o.label })) ?? []}
          placeholder={f.placeholder ?? 'Seleccionar o escribir…'}
          allowCustom={f.allowCustom ?? true}
        />
      </div>
    )
  }

  if (f.type === 'factura') {
    const clienteId = negocioContext?.clienteId
    const fetchUrl = clienteId ? `/api/facturas?clienteId=${encodeURIComponent(clienteId)}` : '/api/facturas'

    return (
      <div key={f.name} className={`${cls} ${styles.formFieldFull}`}>
        <Combobox
          label={`${f.label}${f.required ? ' *' : ''}`}
          value={String(values[f.name] ?? '')}
          onChange={(v, opt) => {
            if (opt) {
              setField(f.name, opt.value)
              setField('numeroFactura', opt.label)
            } else {
              setField(f.name, v)
            }
          }}
          options={[]}
          fetchUrl={fetchUrl}
          mapResponse={(data) => {
            if (!Array.isArray(data)) return []
            return data.map((fac: { id: string; numero: string; total?: number; estado?: string }) => ({
              value: fac.id,
              label: fac.numero,
              hint: [fac.estado, fac.total != null ? formatMontoMoneda(fac.total, 'ARS') : null].filter(Boolean).join(' · ') || undefined,
            }))
          }}
          placeholder="Buscar factura del cliente…"
          allowCustom={false}
          minSearchLength={0}
        />
      </div>
    )
  }

  if (f.type === 'radio') {
    return (
      <div key={f.name} className={`${cls} ${styles.formFieldFull}`}>
        <label className={styles.formLabel}>{f.label}{f.required ? ' *' : ''}</label>
        <div className={styles.radioGroup}>
          {f.options?.map((o) => (
            <label key={o.value} className={styles.radioItem}>
              <input
                type="radio"
                name={f.name}
                value={o.value}
                checked={values[f.name] === o.value}
                onChange={() => setField(f.name, o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (f.type === 'checkbox-group') {
    const selected = (values[f.name] as string[]) ?? []
    return (
      <div key={f.name} className={`${cls} ${styles.formFieldFull}`}>
        <label className={styles.formLabel}>{f.label}{f.required ? ' *' : ''}</label>
        <div className={styles.checkboxGroup}>
          {f.options?.map((o) => (
            <label key={o.value} className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, o.value]
                    : selected.filter((v) => v !== o.value)
                  setField(f.name, next)
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div key={f.name} className={cls}>
      <label className={styles.formLabel}>{f.label}{f.required ? ' *' : ''}</label>
      <input
        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}
        className={styles.formInput}
        value={String(values[f.name] ?? '')}
        onChange={(e) => setField(f.name, e.target.value)}
        step={f.type === 'number' ? '0.01' : undefined}
        placeholder={f.placeholder}
        autoComplete={autoComplete}
        list={f.options?.length ? `${f.name}-datalist` : undefined}
      />
      {f.options?.length ? (
        <datalist id={`${f.name}-datalist`}>
          {f.options.map((o) => (
            <option key={o.value} value={o.label} />
          ))}
        </datalist>
      ) : null}
    </div>
  )
}

export { inicialesVendedor }
