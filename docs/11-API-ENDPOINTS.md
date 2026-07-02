# 11 — Catálogo de API (endpoints)

> Convenciones: respuestas JSON vía `plain()` salvo PDF/binarios. Errores con `handleApiError` (español).  
> Auth: cookie de sesión NextAuth (`credentials: 'include'` en fetch cliente).

## Leyenda de permisos

| Símbolo | Significado |
|---------|-------------|
| 🔐 | `requireAuth()` — cualquier usuario logueado |
| 🔑 | `requirePermission('clave')` |
| 🌐 | Público / API key / webhook (sin sesión) |

---

## Auth y perfil

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| * | `/api/auth/[...nextauth]` | 🌐 | NextAuth |
| GET | `/api/auth/login-status` | 🌐 | Estado bloqueo login |
| GET | `/api/perfil` | 🔐 | Perfil actual |
| PATCH | `/api/perfil` | 🔐 | Editar perfil propio |
| PUT | `/api/perfil/password` | 🔐 | Cambiar contraseña |

## Dashboard y reportes

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/dashboard` | 🔐 | KPIs dashboard |
| GET | `/api/reportes/resumen` | 🔐 | Resumen reportes |
| GET | `/api/reportes/fiscal/export` | 🔐 | Export fiscal |
| GET | `/api/reportes/alquiler-parque` | `alquiler.export` | CSV parque en alquiler |
| GET | `/api/reportes/alquiler-cuotas` | `alquiler.export` | CSV cuotas; query `periodo=YYYY-MM` |
| GET | `/api/reportes/alquiler-mrr` | `alquiler.export` | CSV MRR contratos activos |

## Usuarios y roles

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/usuarios` | `usuarios.read` | Listar |
| POST | `/api/usuarios` | `usuarios.create` | Crear |
| GET | `/api/usuarios/[id]` | `usuarios.read` | Detalle |
| PATCH | `/api/usuarios/[id]` | `usuarios.update` | Editar (+ roles si assign) |
| DELETE | `/api/usuarios/[id]` | `usuarios.deactivate` | Baja lógica |
| GET | `/api/roles` | `usuarios.read` | Roles RBAC |

## Clientes

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/clientes` | 🔐 | Listar (filtros query) |
| POST | `/api/clientes` | `clientes.create` | Crear (body opcional: `sucursales[]` con lat/lng) |
| GET | `/api/clientes/[id]` | 🔐 | Detalle |
| PATCH | `/api/clientes/[id]` | `clientes.update` | Editar |
| DELETE | `/api/clientes/[id]` | `clientes.deactivate` | Baja |
| GET | `/api/clientes/[id]/metricas` | `clientes.read` | Métricas CRM |
| GET | `/api/clientes/[id]/historial` | `crm.read` **o** `clientes.read` | OTs + productos para bandeja CRM |
| GET | `/api/clientes/[id]/sucursales` | 🔐 | Listar sucursales activas |
| POST | `/api/clientes/[id]/sucursales` | `clientes.update` **o** `facturas.create` | Crear sucursal (carga rápida desde factura) |
| PATCH | `/api/clientes/[id]/sucursales/[sucursalId]` | `clientes.update` | Editar sucursal |
| DELETE | `/api/clientes/[id]/sucursales/[sucursalId]` | `clientes.update` | Desactivar sucursal |

Body POST sucursal: `{ nombre, direccion, numero, ciudad, lat?, lng?, notas? }`.

## Geocodificación

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/geocoding` | 🔐 | Query: `direccion`, `numero`, `ciudad` → `{ lat, lng }` (Nominatim) |

Usado por `SucursalUbicacionFields` y `SucursalRapidaModal` al validar dirección en mapa.

## Proveedores

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/proveedores` | `proveedores.read` | Listar |
| POST | `/api/proveedores` | `proveedores.create` | Crear |
| GET/PATCH/DELETE | `/api/proveedores/[id]` | read/update/deactivate | CRUD |

## Presupuestos

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/presupuestos` | `presupuestos.read` | Listar |
| POST | `/api/presupuestos` | `presupuestos.create` | Crear (acepta `otId`) |
| GET | `/api/presupuestos/[id]` | `presupuestos.read` | Detalle |
| PATCH | `/api/presupuestos/[id]` | `presupuestos.update` / `approve` | Editar / aprobar |
| DELETE | `/api/presupuestos/[id]` | `presupuestos.delete` | Eliminar |
| POST | `/api/presupuestos/[id]/convertir` | `presupuestos.approve` | Convertir a factura |
| GET | `/api/presupuestos/[id]/pdf` | `presupuestos.read` | PDF |

## Facturas

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/facturas` | 🔐 | Listar |
| POST | `/api/facturas` | `facturas.create` | Crear borrador (valida sucursal en ítems EQUIPO) |
| GET/PATCH | `/api/facturas/[id]` | read/create | Detalle / editar borrador |
| POST | `/api/facturas/[id]/emitir` | `facturas.emit_afip` | Solicitar CAE |
| POST | `/api/facturas/[id]/provisionar-equipos` | `facturas.create` | Provisión manual de equipos desde factura |
| GET | `/api/facturas/[id]/pdf` | `facturas.read` | PDF fiscal |
| GET | `/api/facturas/[id]/entrega` | `facturas.read` | PDF de entrega = factura + brochures (PDF) de los equipos vendidos (merge `pdf-lib`) |
| GET/POST | `/api/facturas/[id]/remito` | `facturas.read` | Remito PDF desde ítems de factura |
| GET | `/api/facturas/items/[id]/detalle` | `crm.read` **o** `clientes.read` | Detalle ítem (equipo, kit, sucursal) para historial CRM |

## Cobranzas

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/cobranzas` | `cobranzas.read` | Listar pagos |
| GET | `/api/cobranzas/pagos` | `cobranzas.read` | Listar pagos (paginado; filtros: `clienteId`, `referencia`, `fechaDesde`, `fechaHasta`, `page`, `limit`) |
| POST | `/api/cobranzas` | `cobranzas.register_payment` | Registrar pago |
| GET | `/api/cobranzas/vencimientos` | `cobranzas.read` | Cronograma unificado; query `origen=TODOS\|FACTURA\|ALQUILER`, `dias` |

## Alquiler de equipos

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/alquiler/resumen` | `alquiler.read` | KPIs módulo (activos, cuotas, MRR) |
| GET/POST | `/api/alquiler/contratos` | read / `alquiler.create` | Listar / crear contrato |
| GET/PATCH | `/api/alquiler/contratos/[id]` | read / `alquiler.update` | Detalle / editar borrador |
| POST | `/api/alquiler/contratos/[id]/activar` | `alquiler.update` | Activar → unidades EN_ALQUILER |
| POST | `/api/alquiler/contratos/[id]/suspender` | `alquiler.update` | Suspender (sin cuotas nuevas) |
| POST | `/api/alquiler/contratos/[id]/finalizar` | `alquiler.close` | Cierre + devolución líneas |
| POST | `/api/alquiler/contratos/[id]/cancelar` | `alquiler.close` | Cancelar contrato |
| POST | `/api/alquiler/contratos/[id]/facturar` | `alquiler.bill` | Factura BORRADOR por período |
| POST | `/api/alquiler/lineas/[id]/devolver` | `alquiler.close` | Devolver unidad al stock |
| GET | `/api/alquiler/unidades-disponibles` | `alquiler.read` | Unidades EN_STOCK elegibles |

Ver [`24-alquiler-equipos.md`](24-alquiler-equipos.md).

## Inventario y compras

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/inventario` | 🔐 / `inventario.create` | Stock |
| POST | `/api/inventario/[id]/ajustar` | `inventario.adjust_stock` | Ajuste ENTRADA/SALIDA/AJUSTE |
| POST | `/api/inventario/[id]/transferir` | `inventario.transfer` | Transferencia entre depósitos (trazabilidad) |
| POST/DELETE | `/api/inventario/[id]/foto` | `inventario.update` | Subir / quitar foto del producto |
| POST/DELETE | `/api/inventario/[id]/brochure` | `inventario.update` | Subir / quitar brochure (PDF, máx. 20 MB) del producto |
| GET | `/api/inventario/media/[...path]` | `inventario.read` | Servir foto (imagen) o brochure (PDF) |
| GET | `/api/inventario/faltantes` | `compras.read` | Ítems bajo mínimo |
| POST | `/api/inventario/generar-oc` | `compras.create` | Generar OC desde faltantes |
| GET/POST | `/api/ordenes-compra` | `compras.read/create` | Órdenes de compra |
| POST | `/api/ordenes-compra/[id]/recibir` | `compras.receive` | Recepción |

## Servicio técnico (OT)

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/ots` | 🔐 / `servicio.create` | Listar (filtros: `q`, `estado`, `tecnicoId`, `clienteId`, `sla`, `prioridad`, `tipo`) / crear OT |
| GET/PATCH | `/api/ots/[id]` | 🔐 / `servicio.update` | Detalle JSON (`plain()`) con historial y repuestos |
| GET | `/api/ots/[id]/pdf` | `servicio.read` | Informe post-servicio PDF |
| GET/POST | `/api/ots/[id]/remito` | `servicio.read` | Remito PDF (POST emite número; GET `?preview=true` sin correlativo) |
| GET/PATCH | `/api/equipos/[id]` | 🔐 / `servicio.update` | Equipo |
| * | `/api/equipos/[id]/notas` | `servicio.update` | Notas |
| * | `/api/equipos/[id]/accesorios` | `servicio.update` | Accesorios |
| * | `/api/equipos/[id]/componentes` | `servicio.update` | Componentes / historia clínica |
| GET | `/api/equipos/alertas` | 🔐 | Alertas equipos |

## Tracking

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/tracking` | `tracking.read/create` | Eventos |
| GET | `/api/tracking/mapa` | `tracking.read` | Geo mapa |
| GET | `/api/tracking/equipo/[id]` | `tracking.read` | Historial equipo |

## Mantenimiento preventivo

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/mantenimiento` | `preventivo.read/schedule` | Planes |
| PATCH | `/api/mantenimiento/[id]` | `preventivo.complete` | Completar |

## CRM

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/crm/conversaciones` | `crm.read` | Inbox; query: `canal`, `estado`, `asignadoId`, `sinAsignar=true` |
| GET/PATCH | `/api/crm/conversaciones/[id]` | `crm.read` / `crm.assign` o `crm.reply` | Thread; PATCH: `estado`, `asignadoId`, `clienteId`, `etiquetas` |
| POST | `/api/crm/conversaciones/[id]/mensajes` | `crm.reply` | Responder; body: `contenido`, `adjuntoUrl` (opcional) |
| POST | `/api/crm/adjuntos` | `crm.reply` | Subir adjunto (multipart: `archivo`, `conversacionId`) |
| GET | `/api/crm/media/[...path]` | `crm.read` | Descargar adjunto CRM |
| GET/POST/PATCH/DELETE | `/api/crm/snippets` | `crm.reply` / `crm.manage_channels` | Respuestas rápidas |

### CRM — Embudo de ventas

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/crm/embudo` | `crm.read` | Kanban negocios |
| POST | `/api/crm/embudo` | `crm.reply` | Crear negocio |
| GET | `/api/crm/embudo/catalogos` | `crm.read` | Clientes, inventario, usuarios para formularios |
| PATCH | `/api/crm/embudo/[id]` | `crm.reply` | Editar negocio |
| DELETE | `/api/crm/embudo/[id]` | `crm.reply` | Eliminar |
| POST | `/api/crm/embudo/[id]/mover` | `crm.reply` | Cambiar etapa Kanban |
| GET | `/api/crm/embudo/[id]/historial` | `crm.read` | Historial transiciones |

## Configuración — Emisores y fiscal

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/emisores` | `emisores.read/create` | Emisores AFIP |
| PATCH/DELETE | `/api/emisores/[id]` | update/delete | Editar emisor |
| POST | `/api/emisores/[id]/certificado` | `emisores.update` | Subir .crt + .key |
| GET/PATCH/POST | `/api/alicuotas-iva` | 🔐 / `config.update` | Alícuotas IVA |
| GET/PATCH/POST | `/api/contabilidad/catalogos` | `config.manage_accounting` | Catálogos AR |
| GET/POST | `/api/contabilidad/resumen` | `config.manage_accounting` | Resumen / seed catálogos |
| PATCH | `/api/contabilidad/config` | `config.manage_accounting` | Config contable |

## Plantillas de impresión

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/POST | `/api/plantillas` | `config.manage_billing_templates` | Listar / crear |
| PATCH | `/api/plantillas/[id]` | idem | Guardar config / predeterminado |
| GET | `/api/plantillas/[id]/preview` | idem | PDF por id |
| GET/POST | `/api/plantillas/preview` | idem | PDF factory (GET) o borrador (POST body `{config}`) |
| POST | `/api/plantillas/restaurar` | idem | Body `{tipo}` — restaura fábrica |
| POST | `/api/plantillas/[id]/imagenes` | idem | Subir logo (multipart `archivo`) |
| GET | `/api/plantillas/media/[...path]` | idem | Servir imagen de storage |

Ver detalle: [`12-PLANTILLAS-PDF.md`](12-PLANTILLAS-PDF.md).

## Integraciones

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET/PATCH | `/api/integraciones/canales` | `config.manage_integrations` | Canales |
| GET/PATCH | `/api/integraciones/canales/[tipo]` | idem | Por tipo (EMAIL, WHATSAPP, N8N…) |
| GET | `/api/integraciones/graph/authorize` | idem | OAuth Microsoft |
| GET | `/api/integraciones/graph/callback` | 🌐 | Callback OAuth |

## n8n (API key)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/n8n/crear-lead` | 🌐 API key | Lead CRM |
| POST | `/api/n8n/crear-ot` | 🌐 API key | Crear OT |
| POST | `/api/n8n/responder` | 🌐 API key | Responder conversación |
| POST | `/api/n8n/etiquetar` | 🌐 API key | Etiquetar |

## ML (lectura, token de servicio)

Auth: header `Authorization: Bearer $ML_API_KEY`. Solo lectura, sin PII. Detalle en [`HANDOFF-INTEGRACION-ML-VISION.md`](HANDOFF-INTEGRACION-ML-VISION.md).

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/ml/clientes` | 🌐 `ML_API_KEY` | Clientes activos + equipos + asignaciones (`?cliente=<id>` filtra) |
| GET | `/api/ml/equipos/[id]` | 🌐 `ML_API_KEY` | Ficha acotada de un equipo (marca/modelo/serie/estado/cliente) |

## Webhooks y cron

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| * | `/api/webhooks/whatsapp` | Meta verify | WhatsApp |
| * | `/api/webhooks/meta` | Meta verify | Meta |
| POST | `/api/cron/cobranzas-vencimientos` | `CRON_SECRET` | Job vencimientos |
| POST | `/api/cron/alquiler-cuotas` | `CRON_SECRET` | Cuotas mensuales alquiler + marcar vencidas |
| POST | `/api/cron/ots-vencidas` | `CRON_SECRET` | Marcar OTs con SLA vencido + email SLA próximo |
| POST | `/api/cron/presupuestos-vencidos` | `CRON_SECRET` | Marcar presupuestos con vigencia vencida |
| POST | `/api/cron/notificaciones-operativas` | `CRON_SECRET` | Email preventivo próximo (respeta reglas) |
| POST | `/api/cron/stock-minimo` | `CRON_SECRET` | Alertas stock mínimo (dedup diaria) |
| POST | `/api/cron/resumen-semanal` | `CRON_SECRET` | Email KPIs admin (dedup semanal, dom 08:00) |

Rutas cron: rate limit in-memory por IP tras fallos de auth (`lib/cron/rate-limit.ts`).

## Auditoría y logs

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| GET | `/api/auditoria` | `auditoria.read` | Listado paginado AuditLog (filtros: q, entidad, usuarioId) |
| GET | `/api/logs` | `logs.read` | Listado paginado SystemLog (filtros: q, nivel, origen, dia, usuarioId) |

Query GET `/api/logs`: `dia=YYYY-MM-DD` agrupa por día local; respuesta incluye `filtros.dias` (últimos 15).

Ver [`17-OBSERVABILIDAD-Y-LOGS.md`](17-OBSERVABILIDAD-Y-LOGS.md).

---

## Contratos comunes

### Error JSON

```json
{ "error": "Mensaje en español" }
```

Status: 400 validación, 401 sin sesión, 403 sin permiso, 404 no encontrado, 500 interno.

### Paginación / filtros

Varían por endpoint; revisar schema Zod en cada `route.ts`.

### Idempotencia

- Plantillas: `predeterminado: true` desmarca otras del mismo `tipo` en transacción.
- Emisores: igual patrón para `predeterminado`.
