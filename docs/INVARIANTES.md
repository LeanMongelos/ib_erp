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
| E3 | POST/PATCH/mover embudo usan schemas de `lib/validation.ts` | `embudoNegocioCreateSchema`, `embudoNegocioPatchSchema`, `embudoMoverSchema` | `npm run test:invariants` |
| E4 | GET conversaciones acepta `asignadoId` y `sinAsignar=true` | `app/api/crm/conversaciones/route.ts` | `test-crm-backlog.ts` |
| E5 | Mensaje CRM: texto o `adjuntoUrl` (schema compartido) | `crmMensajeContenidoSchema` | `test-crm-backlog.ts` |
| E6 | Doc→Propuesta crea presupuesto ENVIADO; ganar aprueba; cierre vincula factura; PERDIDO excluido de KPIs | `embudo-presupuesto.ts` · `embudo-sincronizar-presupuesto.ts` | `test-embudo-presupuesto-flow.ts` |
| E7 | Seguimiento embudo: CREACION/EDICION/ELIMINACION/MOVIMIENTO/REACTIVACION en `HistorialEmbudo`; lectura `crm.read`; admin SUPERADMIN edita/borra/reactiva | `embudo-historial.ts` · `/api/crm/embudo/seguimiento` | `test-embudo-seguimiento.ts` |

## Servicio técnico (OT)

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| O1 | Repuestos OT: misma validación UI ↔ API | `lib/ots/repuestos-ot-client.ts` | `npm run test:validaciones` |
| O2 | Cierre OT: stock validado y descontado en **una transacción** | `app/api/ots/[id]/route.ts` | — |
| O3 | Repuestos con `inventarioId`: precio re-resuelto en API | `lib/ots/repuestos-ot.ts` | — |
| O4 | SLA vencido: cron HTTP o script VPS ejecuta `actualizarOTsVencidas` (idempotente) | `app/api/cron/ots-vencidas` · `scripts/actualizar-ots-vencidas.ts` | — |
| O5 | Transiciones OT validadas en UI y API | `lib/ots/transiciones-client.ts` | `test-ots-transiciones.ts` |
| O6 | GET `/api/ots` acepta filtros de listado (`q`, `estado`, `tecnicoId`, `sla`, …) | `app/api/ots/route.ts` · `lib/ots/listar-ots.ts` | — |
| O7 | Listado OT en UI usa GET `/api/ots` con filtros sincronizados en URL | `OTsTable.tsx` · `servicio-tecnico/page.tsx` | manual |
| O8 | Informe OT PDF vía `GET /api/ots/[id]/pdf` (`servicio.read`) | `lib/ots/render-informe-pdf.tsx` | `test-checklist-solucion.ts` |
| O9 | Cierre OT correctiva/garantía/calibración con equipo crea plan preventivo si no hay activo (idempotente) | `lib/ots/plan-preventivo-post-cierre.ts` | manual · `crearPlanPreventivo: false` en PATCH |
| O10 | Remito mínimo PDF desde OT o factura (`servicio.read` / `facturas.read`) | `lib/remitos/emitir.ts` | `test-remito-minimo.ts` |

## Integraciones / n8n

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| N1 | POST n8n crear OT usa `otN8nCreateSchema` (= `otCreateSchema`) | `lib/validation.ts` | `npm run test:validaciones` |
| N2 | POST n8n responder usa `mensajeN8nResponderSchema` (= `crmMensajeContenidoSchema`) | `lib/validation.ts` | `npm run test:validaciones` |
| N3 | POST n8n etiquetar usa `conversacionEtiquetasN8nSchema` | `lib/validation.ts` | `npm run test:validaciones` |
| N4 | POST n8n crear lead usa `leadN8nCreateSchema` | `lib/validation.ts` | `npm run test:validaciones` |
| N5 | **Todas** las rutas `/api/n8n/*` validan `verifyN8nApiKey` (Bearer `N8N_API_KEY`) | `lib/crm/n8n.ts` · `validateN8nBearerToken` | `npm run test:invariants` (`test-n8n-api-security.ts`) |
| N6 | Cron `notificaciones-operativas` emite `cliente.sin_respuesta_2h` (dedup SystemLog por mensaje entrante) | `lib/crm/sin-respuesta-2h.ts` | cron manual |

## Operaciones / deploy

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| I1 | Post-deploy: integridad de datos (plantillas, equipos, OT stock, config) | `scripts/integridad-prod.ts` | `npm run integridad:prod` (VPS vía `vps-deploy-from-git.sh`) |
| I6 | Presupuesto CONVERTIDO debe tener factura vinculada | `integridad-prod.ts` | `integridad:prod` (error) |
| I7 | Factura EMITIDA/PAGADA/VENCIDA debe tener `plantillaId` | `integridad-prod.ts` + backfill | `integridad:prod` (error) |
| I8 | Factura EMITIDA/PAGADA/VENCIDA debe tener CAE | `integridad-prod.ts` | `integridad:prod` (warn en homologación · error si emisor activo `PRODUCCION`) |
| I8b | Emisor activo `PRODUCCION` debe tener certificado + clave | `integridad-prod.ts` + `validar-emision.ts` | `integridad:prod` (error) · `test-validar-emision-afip.ts` |
| I2 | OT ABIERTA/EN_PROCESO con SLA vencido debe pasar a VENCIDA (`actualizarOTsVencidas`) | `lib/ots.ts` + cron `POST /api/cron/ots-vencidas` | `integridad:prod` (warn) · `npm run cron:ots-vencidas` |
| I3 | Conversaciones CRM abiertas deben vincularse a cliente (`clienteId`) | bandeja CRM / crear-lead n8n | `integridad:prod` (warn) |
| I4 | Predeterminado activo **único** por tipo (plantilla, emisor, lista precios) | APIs config + `integridad-prod.ts` | `integridad:prod` (warn) |
| I5 | Negocios embudo activos (≠ CIERRE) con `clienteId` en BD cuando hay cliente real | formulario embudo | `integridad:prod` (warn) |
| I9 | Cuotas vencidas deben pasar a `AVISO_ENVIADO` (cron cobranzas idempotente) | `procesarVencimientosDelDia` · `POST /api/cron/cobranzas-vencimientos` | `integridad:prod` (warn) |
| I9b | Cuotas impagas vencidas marcan factura `EMITIDA` → `VENCIDA`; recordatorio cliente deduplicado | `marcarFacturasVencidasPorCuota` · `notify-cliente-recordatorio.ts` | cron manual |
| Co1 | Imputación de cobranza ≤ saldo pendiente; solo facturas cobrables | `lib/cobranzas/validar-pago.ts` · POST `/api/cobranzas` | `test-validar-cobranza-saldo.ts` |
| Co2 | Pago `CHEQUE` tiene fila en `cheques_cobranza`; cartera vencida alerta en integridad | `lib/cobranzas/cheques.ts` · `integridad-prod.ts` | `integridad:prod` (warn/error) |
| Co3 | OC en `BORRADOR` no se recepciona; aprobación → `ENVIADA` | `app/api/ordenes-compra/[id]/aprobar` · recibir | manual |
| I10 | Emisor `PRODUCCION` activo exige `ADMIN_NOTIFY_EMAIL` + SMTP (o EMAIL_IMAP) para alertas AFIP | `lib/admin/go-live-status.ts` · `validar-env-prod` | `go-live:check` (warn/fail) |
| I11 | Cola AFIP (Redis): jobs fallidos o PENDIENTE_CAE atascadas alertan en integridad | `lib/afip/health-cola.ts` · `integridad-prod.ts` | `integridad:prod` (warn) |
| Inv1 | Transferencia entre depósitos (`TRANSFERENCIA`) no altera stock global | `lib/inventario.ts` · POST `.../transferir` | manual |
| N1 | Email OT SLA / preventivo respeta `ReglaNotificacion` activa; dedup diaria | `lib/notificaciones/procesar-emails-operativos.ts` | cron manual |
| Pv1 | Plan PROGRAMADO/PENDIENTE con `proximoServicio` pasado → VENCIDO (`actualizarPlanesMantenimientoVencidos`, idempotente) | `lib/mantenimiento/actualizar-vencidos.ts` · cron `POST /api/cron/notificaciones-operativas` | `test-preventivo-vencidos.ts` |

## Alquiler de equipos

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| Al1 | Cuota única por `lineaId` + `periodo` (cron idempotente) | `lib/alquiler/generar-cuotas-mes.ts` | cron manual |
| Al2 | Solo contratos `ACTIVO` reciben cuotas nuevas; `SUSPENDIDO` no | `generar-cuotas-mes.ts` | — |
| Al3 | Activar contrato → unidad `EN_ALQUILER`; devolver → `EN_STOCK` | `activar-contrato.ts` · `devolver-linea.ts` | manual |
| Al4 | Cobro imputa solo facturas emitidas; cuota sin AFIP no aparece en formulario pago | `cronograma-cobranzas.ts` · `validar-pago.ts` | manual |
| Al5 | Pago que salda factura alquiler → cuotas vinculadas `COBRADA` | `sincronizar-cuota-cobrada.ts` | manual |

## Presupuestos

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| Pr1 | Presupuesto **no** exige `sucursalInstalacionId`; la sucursal se valida al **facturar** (F2) | `itemPresupuestoSchema` | `npm run test:validaciones` |
| Pr2 | Total presupuesto = subtotal + IVA + interés (POST y PATCH usan `calcularTotalesPresupuesto`) | `lib/presupuestos/calcular-total-presupuesto.ts` | `npm run test:validaciones` |
| Pr3 | ENVIADO/APROBADO con `fechaVencimiento` pasada → VENCIDO (`actualizarPresupuestosVencidos`, idempotente) | `lib/presupuestos/actualizar-vencidos.ts` · cron `POST /api/cron/presupuestos-vencidos` | `test-presupuestos-vencidos.ts` · `integridad:prod` (warn) · `npm run cron:presupuestos-vencidos` |

## Clientes

| ID | Invariante | Resolvedor | Test |
|----|------------|------------|------|
| C1 | Sucursales: misma regla en UI y API (nombre, dirección, geo) | `lib/clientes/validar-sucursales.ts` | `npm run test:validaciones` |
| C2 | POST/PATCH sucursales usan schemas de `lib/validation.ts` | `sucursalInstalacionCreateSchema`, `sucursalInstalacionUpdateSchema` | `npm run test:invariants` |

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
| F7 | POST/PATCH factura y POST/PATCH presupuesto/inventario usan schemas de `lib/validation.ts` | `facturaCreateSchema`, `facturaUpdateSchema`, etc. | `npm run test:invariants` |
| F8 | POST generar OC desde faltantes usa `generarOcFaltantesSchema` | `lib/validation.ts` | `npm run test:invariants` |
| F9 | Tras emisión `EMITIDA` con CAE, PDF disponible on-demand vía `GET /api/facturas/[id]/pdf` (`renderDocumentoPDF`) | `app/api/facturas/[id]/pdf/route.ts` | smoke manual post go-live |
| F10 | Cuotas cobranza se crean al **crear** factura con plazos (`sincronizarVencimientosCobranza`), no al emitir AFIP | `app/api/facturas/route.ts` POST | — |
| F11 | Tras emisión `EMITIDA`, email al cliente con PDF adjunto si tiene email y no opt-out (`[no-email-factura]` en notas); no bloquea emisión | `lib/facturas/notify-cliente-emitida.ts` · `FACTURA_EMAIL_CLIENTE` | smoke manual · SystemLog `factura-cliente-email` |
| F12 | Factura emitida con CAE se anula vía NC AFIP (`POST /api/facturas/[id]/anular`); borrador sin CAE → `ANULADA` directa; bloqueo si hay cobranzas o cheques en cartera | `lib/facturas/anular.ts` · `lib/afip/emitir-nota-credito.ts` | `test-anular-factura.ts` |
| Co5 | Cheque `(numero, banco)` único entre activos; anular revierte imputación | `lib/cobranzas/cheques.ts` · migración unique | `test-cheques-cobranza.ts` · `integridad:prod` |
| Co6 | Pago no-cheque anulable revierte imputación; factura recalcula EMITIDA/VENCIDA/PAGADA | `lib/cobranzas/revertir-pago.ts` · PATCH pagos | manual |
| Co7 | Conciliación cobranza marca `conciliadoEn` + usuario | PATCH pagos `conciliar` · `cobranzas.reconcile` | manual |

## Operación (OT / inventario)

| ID | Invariante | Dónde | Test |
|----|------------|-------|------|
| O1 | Listado OT: filtros vía GET `/api/ots` y URL (`OTsTable`), no solo cliente | `components/servicio-tecnico/OTsTable.tsx` | manual |
| O2 | Badge stock bajo en nav Inventario y Compras usa `contarArticulosStockBajo()` | `app/(dashboard)/layout.tsx` · `Sidebar.tsx` | manual |
| O3 | Import inventario CSV idempotente por SKU (actualiza existente) | `lib/inventario/import-csv.ts` | `npm run test:invariants` |

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
| `npm run integridad:prod` | Chequeos de datos en producción (post-deploy) |
| `npm run smoke:http` | Login HTTP + APIs/páginas (servidor levantado; no en CI estándar) |
| `backfill-plantillas-documentos.ts --execute` | Snapshot plantilla en docs viejos (prod; incluido en `vps-deploy-from-git.sh`) |
| `npm run cron:presupuestos-vencidos` | Marcar presupuestos con vigencia vencida |
| `npm run go-live:check` | Checklist pre primera factura real (entorno + emisores + alertas + integridad) |
| `npm run post-go-live:smoke` | Smoke operador post go-live (checklist + AFIP homolog + health + PM2) |

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
