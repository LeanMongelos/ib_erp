/** Client-safe helper — mirrors trazabilidadActiva sin imports server. */
export function trazabilidadActivaClient(modo: string): boolean {
  return modo !== 'NINGUNA' && modo !== ''
}
