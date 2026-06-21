import type { DatosDocumentoRender } from './types'

/** Datos alineados al presupuesto real IB (Haemonetics / HAC). */
export function datosEjemploPlantilla(tipo: 'FACTURA' | 'PRESUPUESTO' | 'REMITO'): DatosDocumentoRender {
  const emisor = {
    razonSocial: 'INGENIERIA BIOMEDICA',
    cuit: '20-24440827-4',
    condicionIva: 'IVA Responsable Inscripto',
    ingresosBrutos: '20-24440827-4',
    inicioActividades: '01-08-2003',
    domicilio: 'Eva Peron Nº679 - 3600 Formosa',
    telefono: '3705 343364',
    email: 'ingenieriabiomedica@hotmail.com',
  }

  const cliente = {
    nombre: 'HOSPITAL DE ALTA COMPLEJIDAD PTE. J.D. PERON',
    direccion: 'AV. NESTOR KIRCHNER Y P. GOMEZ 0 - FORMOSA',
    cuit: '30-70902717-0',
    condicionIva: 'Exento',
    condicionPago: 'TRANSFERENCIA',
    direccionEntrega: 'AV. NESTOR KIRCHNER Y P. GOMEZ 0',
    vendedor: 'Guillermo IB',
  }

  const items = [
    {
      codigo: 'REP-01',
      descripcion: 'Filtro de aire',
      descripcionLarga: null as string | null,
      fotoUrl: null as string | null,
      cantidad: 2,
      precioUnit: 45000,
      subtotal: 90000,
    },
    {
      codigo: 'HOE098',
      descripcion: 'Sist. recolecc. multicomponen MCS+ HAEMONETICS.',
      descripcionLarga:
        'Sistema de Recolección Multicomponente. La recolección de aféresis móvil representa la extensión natural de la población fija de donantes existente en su centro. El dispositivo terapéutico móvil MCS+, pequeño y portátil, está diseñado para entornos hospitalarios y centros de sangre móviles. Proporciona un tratamiento agradable y cómodo para los pacientes. Donaciones de componentes: Plaquetas, Glóbulos rojos, Plasma.',
      fotoUrl: null as string | null,
      cantidad: 1,
      precioUnit: 102102000,
      subtotal: 102102000,
    },
    {
      codigo: 'HOR010',
      descripcion: 'Protocolo Kits 980 MCS+ HAEMONETICS.',
      descripcionLarga: 'Closed Therapeutic Plasma Exchange disposable set',
      fotoUrl: null,
      cantidad: 1,
      precioUnit: 4312500,
      subtotal: 4312500,
    },
    {
      codigo: 'HOR009',
      descripcion: 'Prtocolo kits 997 MCS+ HAEMONETICS . Plaquetoferesis',
      descripcionLarga: '',
      fotoUrl: null,
      cantidad: 1,
      precioUnit: 4312500,
      subtotal: 4312500,
    },
  ]

  const subtotal = 110817000.01
  const iva = 0
  const interesFinanciacion = Math.round(subtotal * 0.02 * (90 / 30) * 100) / 100
  const base = {
    numero: '000000000134',
    fechaEmision: '2025-10-23T12:00:00.000Z',
    emisor,
    cliente,
    items,
    subtotal,
    iva,
    total: subtotal + iva + interesFinanciacion,
    bonificacionPct: 0,
    condicionPago: '30-60-90 días',
    formaPago: 'Transferencia bancaria',
    plazoEntrega: 'Según stock',
    garantia: '12 Meses',
    observaciones: '',
    vigenciaDias: 5,
    tasaFinanciacionPct: 2,
    interesFinanciacion,
  }

  if (tipo === 'FACTURA') {
    return {
      ...base,
      tipo: 'FACTURA',
      tipoFactura: 'B',
      presupuestoNumero: '000000000134',
      cae: '71234567890123',
      caeVencimiento: new Date(Date.now() + 10 * 86400000).toISOString(),
      qrDataUrl: null,
    }
  }

  if (tipo === 'REMITO') {
    return {
      ...base,
      tipo: 'REMITO',
      subtotal: 0,
      total: 0,
      formaPago: undefined,
      plazoEntrega: undefined,
      garantia: undefined,
      observaciones: 'Entrega de repuestos — OT de ejemplo',
    }
  }

  return { ...base, tipo: 'PRESUPUESTO' }
}
