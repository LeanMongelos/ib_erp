# 25 — Seguimiento de fletes

Módulo operativo para registrar y seguir envíos **entrantes (I)** y **salientes (S)**, alineado a la grilla Excel *AT-Fletes*.

## Modelo

- `SeguimientoFlete` — número único `FLT-{año}-{seq}`.
- Enlaces únicos: `ordenCompraId`, `remitoVentaId` (un flete por documento ERP).
- Opcionales: `facturaCompraId`, `facturaId`, `clienteId`, `proveedorOrigenId`.
- Snapshots de texto: `proveedorOrigenNombre`, `clienteNombre`, `facturaTransporte`.

## Estados

| Estado | Cuándo |
|--------|--------|
| `BORRADOR` | Creado sin datos de seguimiento |
| `EN_TRANSITO` | Hay guía, transportista o fecha de envío |
| `RECIBIDO` | `fechaRecibido` cargada |
| `CANCELADO` | Manual |

## Creación automática

1. **Salida:** al emitir remito de venta (`lib/remitos/venta.ts` → `ensureFleteDesdeRemito`).
2. **Entrada:** tras recepcionar OC (`POST /api/ordenes-compra/[id]/recibir` → `ensureFleteDesdeOC`).

La sincronización actualiza cliente/proveedor desde el documento vinculado y **no pisa** `guiaSeguimiento`, `transportista` ni `importe` si el usuario ya los cargó.

## API

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/fletes` | `fletes.read` |
| POST | `/api/fletes` | `fletes.update` |
| GET | `/api/fletes/[id]` | `fletes.read` |
| PATCH | `/api/fletes/[id]` | `fletes.update` |

Filtros GET: `tipo`, `estado`, `q`, `ordenCompraId`, `remitoVentaId`.

## UI

- `/fletes` — grilla con filtros y modal de alta/edición.
- `FleteEnlaceDoc` — enlace desde remito de venta y modal de OC en Compras.

## Permisos RBAC

`fletes.read` y `fletes.update` en todos los roles operativos (ver `lib/rbac.ts`).
