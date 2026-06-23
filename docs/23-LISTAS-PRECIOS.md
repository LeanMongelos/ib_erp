# 23 · Listas de precios (Fase 1)

> Doc canónico del módulo de precios de venta. Complementa inventario (costo/stock) y proveedores (compras).

---

## Principio ERP

| Dominio | Fuente de precio |
|---------|------------------|
| **Venta** (presupuesto, factura) | `ListaPrecios` + resolver |
| **Compra** (OC) | `ProveedorProducto.costo` únicamente |
| **Inventario** | `precioUnit` = referencia / fallback minorista |

Los ítems de presupuesto y factura **guardan snapshot** del precio al crear el documento. El resolver solo **sugiere** al elegir producto en el picker.

---

## Modelo

- `ListaPrecios`: cabecera (código, tipo, moneda, descuento global, vigencia, predeterminada).
- `ListaPreciosItem`: precio por `inventarioId` + bonificación por ítem.
- `Cliente`: `listaPreciosId?`, `esMayorista`, `monedaPreferida?`.

Tipos: `MINORISTA`, `MAYORISTA`, `INSTITUCIONAL`, `PROMOCION`, `ESPECIAL`.

Seed demo: `MIN-ARS` y `MAY-ARS` predeterminadas; mayorista = 85% del minorista (solo ítems ARS con precio).

---

## Resolver (`lib/precios/resolver-precio.ts`)

Prioridad al sugerir precio:

1. Lista asignada al cliente (`listaPreciosId`)
2. Cliente mayorista → lista `MAYORISTA` predeterminada (misma moneda)
3. Lista `MINORISTA` predeterminada
4. `Inventario.precioUnit` si la moneda coincide
5. `0` (origen `SIN_PRECIO`)

API: `GET /api/precios/resolver?inventarioId=&clienteId=&moneda=ARS`  
Permiso: `presupuestos.read` **o** `facturas.read`.

---

## UI

| Ruta | Uso |
|------|-----|
| `/configuracion/listas-precios` | ABM listas + grilla producto × precio |
| `/crm/[id]` → Datos generales | Lista asignada, mayorista, moneda preferida |
| Presupuesto / Factura nueva | `InventarioPicker` con `clienteId` + chip de origen |

Etiquetas UI: «Lista minorista», «Lista mayorista», «Precio base inventario».

---

## RBAC

| Permiso | Roles típicos |
|---------|----------------|
| `listas_precios.read` | VENTAS, FACTURACION, GERENTE |
| `listas_precios.manage` | GERENTE, SUPERADMIN |

---

## Fuera de alcance (Fase 2)

- `ClientePrecioEspecial`, listas USD operativas, import Excel, `ReglaListaSegmento`.

---

## Archivos clave

- `prisma/schema.prisma` — modelos
- `lib/precios/` — resolver, seed, types
- `app/api/listas-precios/` — CRUD
- `app/api/precios/resolver/` — sugerencia en picker
- `components/configuracion/ListasPreciosManager.tsx`
- `components/crm/ClientePreciosPanel.tsx`
