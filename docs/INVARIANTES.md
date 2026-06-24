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

## Facturación

| ID | Invariante |
|----|------------|
| F1 | Totales siempre desde `calcularTotales` (API); la UI no es fuente de verdad |
| F2 | Validación sucursal para equipos: `validar-sucursal-equipo-client.ts` (UI) = `validar-sucursal-equipo.ts` (API) |
| F3 | Emisión AFIP vía `procesarEmisionFactura`; no duplicar lógica CAE en routes |
| F4 | PDF factura incluye `moneda` y `cotizacionUsd` en `buildDatosFactura` |

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
| `npm run test:plantillas` | Paridad preview/producción: mismo pipeline, mismo tamaño PDF (sin DB) |
| `npm run smoke` | Prisma + seeds contables (con DB) |
| `backfill-plantillas-documentos.ts --execute` | Snapshot plantilla en docs viejos (prod) |

## Anti-patrones (no hacer)

1. **`forPreview: true`** en rutas de producción — solo tests internos si aplica.
2. **Resolver configurable en lectura** sin snapshot — cambia documentos ya emitidos.
3. **Duplicar reglas** en componente cliente sin extraer `*-client.ts` compartible.
4. **Importar `lib/prisma` o `storage`** desde `'use client'`.

## Checklist PR (módulos críticos)

- [ ] ¿Hay un solo resolvedor para la regla de negocio?
- [ ] ¿Se snapshotea en create lo configurable?
- [ ] ¿Preview y prod comparten función?
- [ ] ¿`test:plantillas` o smoke actualizado si tocó plantillas/facturación?
