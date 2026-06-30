/**
 * Búsqueda de productos en inventario (sin acentos, varias columnas, typos leves).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  normalizarTextoBusqueda,
  textoContieneBusqueda,
  tokenizarBusqueda,
} from '@/lib/texto-busqueda'

const TRANSLATE_FROM = 'áàäâãåéèëêíìïîóòöôõúùüûñç'
const TRANSLATE_TO = 'aaaaaaeeeeiiiioooooouuuunc'

const CAMPOS_BUSQUEDA = [
  'nombre',
  'sku',
  'descripcion',
  'categoria',
  'marca',
  'modelo',
  'sinonimo',
  'codigo_barras',
] as const

type FilaInventarioBusqueda = {
  id: string
  nombre: string
  sku: string | null
  descripcion: string | null
  categoria: string | null
  marca: string | null
  modelo: string | null
  sinonimo: string | null
  codigo_barras: string | null
}

function exprCampoNormalizado(col: (typeof CAMPOS_BUSQUEDA)[number]): string {
  return `translate(lower(COALESCE("${col}", '')), '${TRANSLATE_FROM}', '${TRANSLATE_TO}')`
}

function blobInventarioSql(): string {
  return CAMPOS_BUSQUEDA.map(exprCampoNormalizado).join(" || ' ' || ")
}

function camposTextoFila(row: FilaInventarioBusqueda): (string | null | undefined)[] {
  return [
    row.nombre,
    row.sku,
    row.descripcion,
    row.categoria,
    row.marca,
    row.modelo,
    row.sinonimo,
    row.codigo_barras,
  ]
}

/** Prefijo corto para ampliar candidatos cuando la búsqueda estricta no devuelve resultados. */
function prefijoTokenAmplio(token: string): string {
  if (token.length <= 3) return token.slice(0, 2)
  return token.slice(0, 3)
}

/** Búsqueda estricta (substring / ILIKE, sin typos). */
async function buscarInventarioIdsEstricto(q: string, limit: number): Promise<string[]> {
  const tokens = tokenizarBusqueda(q, 2)
  const qNorm = normalizarTextoBusqueda(q)

  if (tokens.length === 0 && qNorm.length < 2) return []

  const blob = blobInventarioSql()
  const condiciones: Prisma.Sql[] = []

  if (tokens.length > 0) {
    for (const t of tokens) {
      condiciones.push(Prisma.sql`(${Prisma.raw(blob)}) LIKE ${'%' + t + '%'}`)
    }
  } else if (qNorm.length >= 2) {
    condiciones.push(Prisma.sql`(${Prisma.raw(blob)}) LIKE ${'%' + qNorm + '%'}`)
  }

  const qRaw = q.trim()
  if (qRaw.length >= 2) {
    const ilike = `%${qRaw}%`
    condiciones.push(
      Prisma.sql`(
        "nombre" ILIKE ${ilike}
        OR COALESCE("sku", '') ILIKE ${ilike}
        OR COALESCE("descripcion", '') ILIKE ${ilike}
        OR COALESCE("marca", '') ILIKE ${ilike}
        OR COALESCE("modelo", '') ILIKE ${ilike}
        OR COALESCE("sinonimo", '') ILIKE ${ilike}
      )`,
    )
  }

  const whereBusqueda =
    condiciones.length === 1
      ? condiciones[0]!
      : Prisma.sql`(${Prisma.join(condiciones, ' OR ')})`

  const tokenAnd =
    tokens.length > 1
      ? Prisma.join(
          tokens.map((t) => Prisma.sql`(${Prisma.raw(blob)}) LIKE ${'%' + t + '%'}`),
          ' AND ',
        )
      : null

  const whereFinal =
    tokenAnd != null
      ? Prisma.sql`(${whereBusqueda}) OR (${tokenAnd})`
      : whereBusqueda

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM inventario
    WHERE activo = true
      AND (${whereFinal})
    ORDER BY nombre ASC
    LIMIT ${limit}
  `

  return rows.map((r) => r.id)
}

/**
 * Segunda fase: candidatos amplios por prefijo + filtro fuzzy en JS.
 * Solo se ejecuta si la búsqueda estricta no devolvió resultados.
 */
async function buscarInventarioIdsFuzzy(q: string, limit: number): Promise<string[]> {
  const tokens = tokenizarBusqueda(q, 2)
  const qNorm = normalizarTextoBusqueda(q)

  if (tokens.length === 0 && qNorm.length < 2) return []

  const prefijos =
    tokens.length > 0
      ? tokens.map(prefijoTokenAmplio)
      : [prefijoTokenAmplio(qNorm)]

  const blob = blobInventarioSql()
  const wherePrefijos = Prisma.join(
    prefijos.map((p) => Prisma.sql`(${Prisma.raw(blob)}) LIKE ${'%' + p + '%'}`),
    ' AND ',
  )

  const cap = Math.min(Math.max(limit * 10, 50), 500)

  const rows = await prisma.$queryRaw<FilaInventarioBusqueda[]>`
    SELECT
      id,
      nombre,
      sku,
      descripcion,
      categoria,
      marca,
      modelo,
      sinonimo,
      codigo_barras
    FROM inventario
    WHERE activo = true
      AND (${wherePrefijos})
    ORDER BY nombre ASC
    LIMIT ${cap}
  `

  return rows
    .filter((row) => textoContieneBusqueda(camposTextoFila(row), q))
    .slice(0, limit)
    .map((r) => r.id)
}

/** IDs que coinciden con la búsqueda (PostgreSQL + fuzzy leve en JS). */
export async function buscarInventarioIds(q: string, limit: number): Promise<string[]> {
  const estrictos = await buscarInventarioIdsEstricto(q, limit)
  if (estrictos.length > 0) return estrictos
  return buscarInventarioIdsFuzzy(q, limit)
}

export type InventarioInclude = Parameters<typeof prisma.inventario.findMany>[0] extends {
  include?: infer I
}
  ? I
  : never

/** Busca productos y devuelve registros Prisma en orden de relevancia (nombre). */
export async function buscarInventarioFlex(
  q: string,
  limit: number,
  include?: NonNullable<Parameters<typeof prisma.inventario.findMany>[0]>['include'],
) {
  const ids = await buscarInventarioIds(q, limit)
  if (ids.length === 0) return []

  const items = await prisma.inventario.findMany({
    where: { id: { in: ids }, activo: true },
    include,
    orderBy: { nombre: 'asc' },
  })

  const byId = new Map(items.map((i) => [i.id, i]))
  return ids.map((id) => byId.get(id)).filter((i): i is NonNullable<typeof i> => i != null)
}
