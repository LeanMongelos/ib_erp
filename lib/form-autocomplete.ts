/** Mapeo de nombres de campo a atributos HTML autocomplete estándar. */

const FIELD_MAP: Record<string, string> = {
  // Persona / contacto
  nombre: 'name',
  contactoNombre: 'name',
  contacto: 'name',
  conQuien: 'name',
  responsableEntrega: 'name',
  contactoCargo: 'organization-title',
  vendedor: 'organization-title',

  // Organización
  razonSocial: 'organization',
  organismo: 'organization',
  cliente: 'organization',
  productoServicio: 'off',

  // Comunicación
  email: 'email',
  telefono: 'tel',
  sitioWeb: 'url',

  // Dirección
  direccion: 'street-address',
  domicilio: 'street-address',
  direccionEntrega: 'street-address',
  ciudad: 'address-level2',
  codigoPostal: 'postal-code',
  pais: 'country-name',

  // Fiscal
  cuit: 'off',
  condicionIva: 'off',
  ingresosBrutos: 'off',

  // Campos de negocio / ERP (sin sugerencia del navegador)
  referencia: 'off',
  numeroSerie: 'off',
  numeroLicitacion: 'off',
  numeroExpediente: 'off',
  numeroOrdenCompra: 'off',
  numeroFactura: 'off',
  sku: 'off',
  marca: 'off',
  modelo: 'off',
  rubro: 'off',
  marcas: 'off',
  notas: 'off',
  observaciones: 'off',
  descripcion: 'off',
  avatarUrl: 'url',
}

const TYPE_MAP: Record<string, string> = {
  email: 'email',
  tel: 'tel',
  password: 'current-password',
  url: 'url',
}

export function resolveAutoComplete(fieldName: string, type?: string): string | undefined {
  if (type && TYPE_MAP[type]) return TYPE_MAP[type]

  const lower = fieldName.toLowerCase()

  if (lower.includes('email')) return 'email'
  if (lower.includes('telefono') || lower.includes('tel') || lower.includes('whatsapp')) return 'tel'
  if (lower.includes('direccion') || lower.includes('domicilio')) return 'street-address'
  if (lower.includes('ciudad')) return 'address-level2'
  if (lower.includes('cuit')) return 'off'
  if (lower.includes('password') || lower.includes('contraseña')) return 'current-password'
  if (lower.includes('nombre') && !lower.includes('negocio') && !lower.includes('producto')) return 'name'
  if (lower.includes('razonsocial') || lower.includes('organismo') || lower.includes('organizacion')) return 'organization'

  return FIELD_MAP[fieldName]
}
