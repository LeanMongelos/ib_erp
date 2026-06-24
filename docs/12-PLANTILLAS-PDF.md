# 12 — Plantillas PDF (motor, editor, reglas)

## 1. Propósito

Generar **Factura**, **Presupuesto** y **Remito** con layout configurable (formato IB — Ingeniería Biomédica), usando `@react-pdf/renderer`.

## 2. Archivos clave

| Archivo | Rol |
|---------|-----|
| `lib/plantillas/types.ts` | `PlantillaConfig`, `LayoutElement`, `ColumnaItem` |
| `lib/plantillas/defaults.ts` | Plantillas fábrica por tipo |
| `lib/plantillas/layout-default-presupuesto.ts` | Layout IB en bloques (mm) |
| `lib/plantillas/render-documento.tsx` | Entry: layout bloques o legacy |
| `lib/plantillas/render-layout.tsx` | Render por bloques posicionados |
| `lib/plantillas/binding-resolver.ts` | **Cliente-safe** — resolve campos |
| `lib/plantillas/resolve-image-src.server.ts` | **Solo servidor** — rutas imagen |
| `lib/plantillas/preview.ts` | Preview con datos ejemplo |
| `lib/plantillas/build-datos.ts` | Prisma → `DatosDocumentoRender` |
| `lib/plantillas/sample-datos.ts` | Datos demo (corto + largo) |
| `lib/plantillas/text-campo.ts` | maxChars, overflow |
| `lib/plantillas/media-url.ts` | URLs preview imágenes (cliente) |
| `components/plantillas/PlantillasManager.tsx` | UI listado + predeterminada |
| `components/plantillas/PlantillaEditor.tsx` | Editor visual drag & drop |
| `components/plantillas/PdfPreviewFrame.tsx` | Preview vía fetch+blob |

## 3. Modelo de datos

```prisma
model PlantillaImpresion {
  id             String
  nombre         String
  tipo           TipoPlantilla  // FACTURA | PRESUPUESTO | REMITO
  config         Json           // PlantillaConfig
  predeterminado Boolean        // una sola true por tipo
  activo         Boolean
  version        Int
}
```

### Reglas de negocio

1. **Una predeterminada por tipo** — al marcar otra, las demás quedan respaldo (`predeterminado: false`).
2. **Emisión usa predeterminada** — `getPlantillaConfig()` en `build-datos.ts` busca `predeterminado: true`; si no hay, usa `defaults.ts`.
3. **Restaurar fábrica** — `POST /api/plantillas/restaurar` resetea config IB y marca predeterminada.
4. **Imágenes subidas** — `storage:plantillas/{id}/{uuid}.ext` en `content` del bloque; servidas por `/api/plantillas/media/...`.

## 4. PlantillaConfig (contrato JSON)

```typescript
interface PlantillaConfig {
  version: number
  tipo: 'FACTURA' | 'PRESUPUESTO' | 'REMITO'
  papel: 'A4' | 'LETTER'
  estilo: { fuente, colorMarca, margenMm }
  encabezado: { mostrarLogo, campos[], leyenda? }
  cliente: { campos[] }
  items: { columnas: ColumnaItem[] }
  totales: { mostrarNeto, mostrarBonificacion, discriminarIva }
  importeEnLetras: boolean
  observaciones: { camposFijos[], textoLibre, leyendaNoFiscal? }
  pieFiscal: { cae, qr }
  layout?: PlantillaLayout  // si existe → render-layout (prioridad)
}
```

### ColumnaItem (tabla ítems)

| Campo | Uso |
|-------|-----|
| `anchoPct` | Ancho columna |
| `maxChars` | Límite caracteres (0 = sin límite) |
| `overflow` | `wrap` \| `ellipsis` \| `truncate` |
| `visible` | Mostrar/ocultar columna |

**Recomendación:** Descripción → `wrap` + ~2500 chars; código/precio → `truncate`.

## 5. Flujo de render PDF

```
API preview/PDF factura
  → getPlantillaConfig(plantillaId?, tipo)
  → buildDatos* (desde Prisma o sample-datos)
  → renderDocumentoPDF(cfg, datos)
      → si cfg.layout.elementos.length → LayoutDocumentPage
      → si no → PresupuestoIB (legacy) o DocumentoSimple
  → Buffer PDF
```

## 6. Editor visual — comportamiento

1. Abrir desde **Editor visual** (requiere plantilla en DB; si no existe, `restaurar` automático).
2. Paleta izquierda → bloques (fiscal, cliente, tabla, logo…).
3. Lienzo A4 — drag posición; panel derecho propiedades + columnas.
4. Preview PDF — `POST /api/plantillas/preview` con `{ config }` (debounced ~600ms).
5. Guardar — `PATCH /api/plantillas/[id]` con `{ config }`.

## 7. Previews en listado — IMPORTANTE para agentes

**No disparar 3 PDFs simultáneos** en dev (bloquea el server Next).

Implementación actual (`PlantillasManager` + `PdfPreviewFrame`):

- Lista plantillas primero (`enabled={!loading}`).
- Previews escalonados: delay 0 / 1200 / 2400 ms por tarjeta.
- Timeout 45s fetch; mensaje de error si falla.

## 8. Frontera cliente/servidor

| Importar en `'use client'` | NO importar |
|----------------------------|-------------|
| `binding-resolver.ts` | `resolve-image-src.server.ts` |
| `media-url.ts` | `lib/storage.ts` |
| `types.ts`, `palette.ts` | `render-documento.tsx` |
| | `build-datos.ts` |

`PlantillaEditor` importa solo `binding-resolver`, no `resolve-binding` completo.

## 9. Referencia visual

Presupuesto IB: logo, fila fiscal, caja cliente 2 cols, tabla encabezado naranja `#E8650A`, totales derecha, observaciones, importe en letras.

Datos ejemplo: `sample-datos.ts` (Haemonetics + ítem corto "Filtro de aire").

## 10. Emisión REMITO / NC — alcance actual

| Tipo | Plantilla / preview | Emisión de negocio |
|------|---------------------|-------------------|
| **NOTA_CREDITO** | Sí (tipo en BD + plantilla predeterminada) | Sí vía `POST /api/facturas/[id]/anular` (NC AFIP) |
| **REMITO** | Sí (preview + editor) | **Diferido** — no hay entrega de mercadería ni numeración R- en flujo productivo |

El remito queda documentado y editable para cuando exista el módulo logístico (OC → recepción → remito cliente).
