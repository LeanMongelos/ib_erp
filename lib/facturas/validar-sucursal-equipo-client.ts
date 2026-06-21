/** Validación cliente (sin imports de servidor). */
export function validarSucursalesInstalacionEquipoCliente(
  items: Array<{ descripcion: string; tipoArticulo?: string; sucursalInstalacionId?: string }>,
): string | null {
  for (const item of items) {
    if (item.tipoArticulo !== 'EQUIPO') continue
    if (!item.sucursalInstalacionId) {
      return `«${item.descripcion || 'Equipo'}»: seleccioná la sucursal de instalación`
    }
  }
  return null
}
