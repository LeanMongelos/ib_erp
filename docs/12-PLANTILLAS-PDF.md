# 12 — Plantillas PDF (motor, editor, reglas)

## 1. Propósito

Generar **Factura**, **Presupuesto** y **Remito** (formato IB — Ingeniería Biomédica). Los tres documentos de fábrica se renderizan desde **plantillas HTML** dedicadas (→ Puppeteer → PDF); el editor visual por bloques (`@react-pdf/renderer`) sigue disponible para plantillas personalizadas. La **Factura** cumple formato **AFIP/ARCA**: recuadro de letra A/B/C, Punto de Venta + Nº de comprobante, CAE + vencimiento + QR, IVA discriminado en A e "IVA incluido" por **alícuota real** en B/C.

## 2. Archivos clave

| Archivo | Rol |
|---------|-----|
| `lib/plantillas/types.ts` | `PlantillaConfig`, `LayoutElement`, `ColumnaItem` |
| `lib/plantillas/defaults.ts` | Plantillas fábrica por tipo |
| `lib/plantillas/layout-default-presupuesto.ts` | Layout IB en bloques (mm) |
| `lib/plantillas/render-documento.tsx` | Entry: layout bloques → **HTML** → legacy |
| `lib/plantillas/render-layout.tsx` | Render por bloques posicionados (solo plantillas personalizadas por el editor) |
| `lib/plantillas/html-factura.html` | **Factura formato AFIP** (letra, Pto Venta/Nº, CAE/QR, IVA) |
| `lib/plantillas/html-presupuesto.html` | Presupuesto (no fiscal) |
| `lib/plantillas/html-remito.html` | Remito (sin precios, con N° de serie + firma) |
| `lib/plantillas/html-templates.ts` | Lee los `.html` · `htmlDefaultPorTipo` |
| `lib/plantillas/render-html.ts` | Sustituye `{{placeholders}}` (incluye IVA por alícuota, CAE, QR) |
| `lib/plantillas/html-to-pdf.server.ts` | HTML → PDF con Puppeteer (inyecta logo) |
| `scripts/sync-plantillas-html.ts` | Post-deploy: migra plantillas de fábrica al motor HTML |
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
      1) si cfg.layout.elementos.length → LayoutDocumentPage (react-pdf)
         └ solo plantillas personalizadas con el editor visual
      2) si no → HTML: cfg.html || htmlDefaultPorTipo(tipo) → Puppeteer
         └ Factura / Presupuesto / Remito de FÁBRICA usan esta rama
      3) fallback → react-pdf (PresupuestoIB / DocumentoSimple)
  → Buffer PDF
```

> **Prioridad:** el layout de bloques gana sobre el HTML. Por eso las plantillas de
> fábrica **no** llevan layout (ver `defaults.ts` + `ensure-layout.ts`, que ya no
> fuerza layout por tipo). En producción, `scripts/sync-plantillas-html.ts` (paso
> del deploy) migra las plantillas de fábrica existentes quitándoles el layout
> legacy → así el rediseño aplica **sin "Restaurar fábrica" manual**.

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
| **REMITO** | Sí (preview + editor) | **Parcial (M2)** — `GET/POST /api/ots/[id]/remito` y `GET/POST /api/facturas/[id]/remito` generan PDF con numeración R-; sin entidad Remito ni flujo logístico OC→recepción |

Emisión mínima: repuestos de OT o ítems de factura, emisor predeterminado, plantilla REMITO predeterminada. Preview: `?preview=true` (no consume correlativo).

El **remito ahora porta el N° de serie** de los equipos vendidos (viaja en la
descripción detalle, vía `lib/remitos/build-datos.ts`) y trae área de firma
"Entregó / Recibí conforme".

## 11. Factura AFIP + IVA por alícuota

- **Datos AFIP** expuestos en `render-html.ts` (`buildHtmlPlaceholderMap`): `factura_letra`,
  `factura_cod_comprobante`, `factura_punto_venta`, `factura_comp_nro`, `factura_cae`,
  `factura_cae_vencimiento`, `factura_qr`, `factura_original`. El Punto de Venta viaja
  desde `Factura.puntoVenta ?? Emisor.puntoVenta` (ver `build-datos.ts`).
- **IVA en B/C:** leyenda "Los precios incluyen IVA. IVA contenido: $X" calculada por la
  **alícuota real de cada ítem** (`ItemFactura.alicuotaIvaPct`) — soporta 21%, 10,5%,
  exento y facturas mixtas. **Nada hardcodeado.** En Factura A el IVA se discrimina.

## 12. Entrega: Factura + brochures

`GET /api/facturas/[id]/entrega` arma un **PDF único** = factura + los brochures (PDF)
de los equipos vendidos que tengan uno cargado (deduplicado por producto, merge con
`pdf-lib`). Ver `lib/facturas/entrega-pdf.ts`. El comprobante fiscal sigue siendo la
factura; los brochures son **anexos informativos** para la entrega formal.
Botón 📦 en la tabla de facturas. El brochure se carga por producto (ver
[`06-inventario-y-compras.md`](06-inventario-y-compras.md)).
