# Documentación — iBiomédica ERP

> Cliente: **Ingeniería Biomédica** (Formosa, AR)  
> Stack: Next.js 14 · Prisma 7 · PostgreSQL · NextAuth · Tailwind · Leaflet · @react-pdf/renderer

---

## Para agentes de código (leer primero)

| Documento | Contenido |
|-----------|-----------|
| **[`../AGENTS.md`](../AGENTS.md)** | Reglas de oro, estructura, checklist, flujos críticos |
| **[`00-ARQUITECTURA-IMPLEMENTADA.md`](00-ARQUITECTURA-IMPLEMENTADA.md)** | Stack real, módulos, middleware |
| **[`14-CONTRATOS-FRONTERAS.md`](14-CONTRATOS-FRONTERAS.md)** | Cliente/servidor, RBAC, anti-patrones |
| **[`11-API-ENDPOINTS.md`](11-API-ENDPOINTS.md)** | Catálogo de route handlers |
| **[`13-FLUJOS-COMERCIALES.md`](13-FLUJOS-COMERCIALES.md)** | OT → presupuesto → factura + sucursales |
| **[`15-ESTADOS-WORKERS-SEGURIDAD.md`](15-ESTADOS-WORKERS-SEGURIDAD.md)** | Estados, workers, seguridad |
| **[`REGLAS-INTERFAZ-ESPAÑOL.md`](REGLAS-INTERFAZ-ESPAÑOL.md)** | UI y errores en español |
| **[`DEV-ESTABILIDAD.md`](DEV-ESTABILIDAD.md)** | Prisma HMR, dev:reset, E2E |

---

## Índice por tipo

### Operativa (refleja el código actual)

| # | Documento | Uso |
|---|-----------|-----|
| 00 | [Arquitectura implementada](00-ARQUITECTURA-IMPLEMENTADA.md) | Qué existe hoy |
| 11 | [API endpoints](11-API-ENDPOINTS.md) | Métodos, permisos, JSON |
| 12 | [Plantillas PDF](12-PLANTILLAS-PDF.md) | Motor PDF, editor |
| 13 | [Flujos comerciales](13-FLUJOS-COMERCIALES.md) | OT, factura, sucursales |
| 14 | [Contratos y fronteras](14-CONTRATOS-FRONTERAS.md) | Client/server, Zod |
| 15 | [Estados, workers, seguridad](15-ESTADOS-WORKERS-SEGURIDAD.md) | Transiciones, BullMQ |

### Diseño / dominio

| # | Documento | Uso |
|---|-----------|-----|
| 01 | [Roles y permisos](01-roles-y-permisos.md) | RBAC |
| 02 | [Facturación AFIP](02-facturacion-afip.md) | CAE, tipos comprobante |
| 03 | [Clientes](03-clientes.md) | Ficha 360°, **sucursales**, mapa |
| 04 | [Proveedores](04-proveedores.md) | Abastecimiento |
| 05 | [CRM omnicanal](05-crm-omnicanal.md) | Bandeja, historial, embudo |
| 06 | [Inventario y compras](06-inventario-y-compras.md) | Stock, venta equipos |
| 07 | [Servicio técnico](07-servicio-tecnico.md) | OT, mapa, preventivo |
| 08 | [Configuración](08-configuracion.md) | Emisores, integraciones |
| 09 | [Modelo de datos](09-modelo-de-datos.md) | Entidades Prisma |
| 10 | [Roadmap](10-roadmap.md) | Fases |

> Ante duda: **`00` + `schema.prisma` + `AGENTS.md`** prevalecen sobre diseño histórico.

---

## Visión del producto

```
Lead/Contacto → Presupuesto → Venta (sucursal obligatoria) → Factura AFIP
     ↓                                      ↓
   CRM Bandeja                         Equipo en mapa ST
     ↓                                      ↓
Cliente + Sucursales geocodificadas → OT / Preventivo / Tracking
```

Principios: trazabilidad punta a punta, RBAC granular, cumplimiento fiscal AFIP, UI en español.

---

## Comandos de desarrollo

```bash
npm run dev              # Desarrollo
npm run dev:reset        # Limpia .next + prisma generate + dev
npm run smoke            # Smoke contabilidad + Prisma
npm run e2e              # E2E CRM, sucursales, historial, geocoding
npm run e2e:all          # Ambos tests
npx prisma migrate deploy && npx prisma generate
npm run db:seed
npm run build
npx tsc --noEmit         # scripts/ excluidos del typecheck Next
```

---

## Rutas UI principales

| Ruta | Módulo |
|------|--------|
| `/dashboard` | KPIs |
| `/crm` | Listado clientes |
| `/crm/nuevo` | Alta cliente + sucursales + mapa |
| `/crm/[id]` | Ficha 360° + panel sucursales |
| `/crm/inbox` | Bandeja omnicanal + historial lateral |
| `/crm/embudo` | Kanban ventas |
| `/presupuestos`, `/facturacion/nueva` | Comercial |
| `/servicio-tecnico/mapa` | Mapa equipos |
| `/configuracion/plantillas` | Editor PDF |

---

## Modelo sucursales (resumen)

| Capa | Entidad | Rol |
|------|---------|-----|
| Cliente | `Cliente` | Datos fiscales / contacto |
| Catálogo | `ClienteSucursal` | Sedes con calle, número, lat/lng |
| Venta | `ItemFactura.sucursalInstalacionId` | Dónde se instala **este** equipo |
| Mapa | `Equipo.sucursalId` | Posición en servicio técnico |

Ver [`03-clientes.md`](03-clientes.md) y [`13-FLUJOS-COMERCIALES.md`](13-FLUJOS-COMERCIALES.md).
