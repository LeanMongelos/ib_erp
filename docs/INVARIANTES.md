# Invariantes del ERP — reglas que no se pueden romper

Documento de referencia para desarrollo, code review y agentes. Si un cambio viola una invariante, debe actualizar el test o el resolvedor correspondiente.

## Plantillas PDF

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| P1 | Preview y PDF de factura/presupuesto usan **el mismo pipeline** (`renderDocumentoPDF`) | `lib/plantillas/render-documento.tsx` | `npm run test:plantillas` |
| P2 | Si la config tiene **layout de bloques**, no se usa HTML/Puppeteer por separado | `renderDocumentoPDF` (layout primero) | `test:plantillas` |
| P3 | Al **crear** factura o presupuesto se persiste `plantillaId` (snapshot) | `resolverPlantillaIdEmision` | API POST + backfill |
| P4 | Al **generar PDF** se resuelve plantilla vía `resolverPlantillaDocumento` | `getPlantillaResuelta` / `build-datos.ts` | smoke manual |
| P5 | La predeterminada por tipo es **única** (`predeterminado: true` en BD) | `PlantillasManager` + API plantillas | — |
| P6 | Al **crear** presupuesto se persiste `plantillaId` y la UI muestra el modelo | `NuevoPresupuestoForm` + `resolverPlantillaIdEmision` | — |

## CRM / Embudo

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| E1 | Movimiento entre etapas: misma regla UI (drag) y API | `lib/crm/embudo-movimiento-client.ts` | `npm run test:validaciones` |
| E2 | Formularios de transición validados en UI y API | `validateForm` en `embudo-forms.ts` | `test:validaciones` |

## Servicio técnico (OT)

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| O1 | Repuestos OT: misma validación UI ↔ API | `lib/ots/repuestos-ot-client.ts` | `npm run test:validaciones` |
| O2 | Cierre OT: stock validado y descontado en **una transacción** | `app/api/ots/[id]/route.ts` | — |
| O3 | Repuestos con `inventarioId`: precio re-resuelto en API | `lib/ots/repuestos-ot.ts` | — |

## Presupuestos

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| Pr1 | Presupuesto **no** exige `sucursalInstalacionId`; la sucursal se valida al **facturar** (F2) | `itemPresupuestoSchema` | `npm run test:validaciones` |
| Pr2 | Total presupuesto = subtotal + IVA + interés (POST y PATCH usan `calcularTotalesPresupuesto`) | `lib/presupuestos/calcular-total-presupuesto.ts` | `npm run test:validaciones` |

## Clientes

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| C1 | Sucursales: misma regla en UI y API (nombre, dirección, geo) | `lib/clientes/validar-sucursales.ts` | `npm run test:validaciones` |

## Facturación

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| F1 | Totales siempre desde `calcularTotales` (API); la UI no es fuente de verdad | `lib/documentos.ts` | — |
| F2 | Validación sucursal para equipos: misma regla UI ↔ API (`tipoArticulo === 'EQUIPO'`) | `lib/facturas/equipo-instalacion-client.ts` | `npm run test:validaciones` |
| F2b | PATCH factura con ítems valida equipos y persiste sucursal/serie | `validar-sucursal-equipo.ts` + `datos-items-factura.ts` | — |
| F3 | Emisión AFIP vía `procesarEmisionFactura`; no duplicar lógica CAE en routes | `lib/afip/emitir.ts` | — |
| F4 | PDF factura incluye `moneda` y `cotizacionUsd` en `buildDatosFactura` | `lib/plantillas/build-datos.ts` | — |
| F5 | Documento USD exige cotización: mismo mensaje UI ↔ API | `lib/moneda-documento-client.ts` | `npm run test:validaciones` |
| F6 | Ítems con `inventarioId`: precio re-resuelto en API al guardar | `lib/precios/aplicar-precios-documento.ts` | — |

## Auth y permisos

| ID | Invariante |
|----|------------|
| A1 | Permisos RBAC en `lib/rbac.ts`; API usa `requirePermission` |
| A2 | Invalidación global de sesiones: incrementar `sesionEpoch` en `politica_seguridad` |

## API ↔ UI

| ID | Invariante |
|----|------------|
| U1 | Formularios críticos envían todos los campos que el API persiste |
| U2 | Errores API en español vía `mensajeErrorRespuesta` / `handleApiError` |
| U3 | PDF en browser: `PdfPreviewFrame` (blob), no iframe directo a API (CSP) |

## CI / deploy

| Comando | Qué garantiza |
|---------|----------------|
| `npm run lint` | Estilo Next/ESLint |
| `npm run build` | Types + compile |
| `npm run test:invariants` | Plantillas + validaciones compartidas (sin DB) |
| `npm run test:plantillas` | Solo paridad PDF plantillas |
| `npm run test:validaciones` | Reglas sucursales clientes + equipos en factura |
| `npm run smoke` | Prisma + seeds contables (con DB) |
| `npm run smoke:http` | Login HTTP + APIs/páginas (servidor levantado) |
| `backfill-plantillas-documentos.ts --execute` | Snapshot plantilla en docs viejos (prod) |

## Anti-patrones (no hacer)

1. **Pipeline distinto** preview vs producción en plantillas — usar siempre `renderDocumentoPDF` / `renderPreviewPlantilla`.
2. **Resolver configurable en lectura** sin snapshot — cambia documentos ya emitidos.
3. **Duplicar reglas** en componente cliente sin extraer `*-client.ts` compartible.
4. **Importar `lib/prisma` o `storage`** desde `'use client'`.

## Checklist PR (módulos críticos)

- [ ] ¿Hay un solo resolvedor para la regla de negocio?
- [ ] ¿Se snapshotea en create lo configurable?
- [ ] ¿Preview y prod comparten función?
- [ ] ¿`test:invariants` o smoke actualizado si tocó plantillas/facturación/clientes?
