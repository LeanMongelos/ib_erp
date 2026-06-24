# Plan maestro — huecos de infraestructura ERP

Auditoría post-cartera de cheques (jun 2026). Objetivo: cerrar gaps donde el **modelo/UI/documentación existen** pero la **lógica de negocio, RBAC o operación** quedan incompletos.

## Patrón “hueco” (ejemplo cheques)

- Enum/medio en schema ✓
- UI de registro ✓
- Falta: cartera, vencimiento, no marcar PAGADA hasta acreditar, permisos, cron, integridad

---

## Fase 1 — Dinero, seguridad y flujos críticos ✅ (aplicada en este ciclo)

| ID | Hueco | Fix aplicado |
|----|-------|--------------|
| C2 | GET `/api/facturas` solo `requireAuth` | `requirePermissionAny('facturas.read', 'cobranzas.read')` |
| C3 | Cobranzas sin tope de saldo / estado | `lib/cobranzas/validar-pago.ts` + validación en POST cobranzas |
| C4 | Rechazo cheque → siempre EMITIDA | Recalcular VENCIDA/EMITIDA según cuotas |
| C5 | Búsqueda global sin RBAC | `buscarEnErp(q, permisos)` filtra por módulo |
| C6 | GET clientes/OTs solo auth | `clientes.read`, `servicio.read` |
| C7 | `emisores.create` sin rol base | GERENTE + CONTABILIDAD |
| C8 | OC recepcionable en BORRADOR | Bloqueo API + botón **Aprobar** → ENVIADA |
| H4 | Worker cobranzas sin cheques | `procesarChequesADepositar` en worker |
| H5 | Regla `cheque.deposito` ignorada en email | Cron cheques respeta regla activa |
| H6 | `servicio.close` / `assign` decorativos | PATCH OT exige permiso extra |
| H7 | `presupuestos.send` decorativo | PATCH exige permiso al pasar a ENVIADO |
| H8 | Export clientes con `read` | Exige `clientes.export` |
| M7 | Integridad sin cheques | Checks cartera vencida + pago CHEQUE huérfano |
| M10 | Matriz roles visible a todos | GET roles exige `config.read` o `usuarios.read` |

**Tests:** `test-validar-cobranza-saldo.ts`, `test-cheques-cobranza.ts` (emisores.create).

---

## Fase 2 — Estado y operación ✅

| ID | Hueco | Acción propuesta | Estado |
|----|-------|------------------|--------|
| C1 | Anulación / NC AFIP | `POST /api/facturas/[id]/anular` + NC + `anularVencimientosPendientes` | ✅ Implementado |
| H3 | `cobranzas.reconcile` sin UI | PATCH conciliar pago + columna en listado | ✅ Implementado |
| H9 | Cheque duplicado / ANULADO | Unique `(numero,banco)` + acción anular | ✅ Implementado |
| H10 | OT sin máquina de estados | `lib/ots/transiciones.ts` compartido UI/API | ✅ Implementado |
| H12 | Health cola AFIP | `checkColaAfip` en integridad-prod | ✅ Implementado |
| — | Reversión pagos transferencia | PATCH `/api/cobranzas/pagos/[id]` anular | ✅ Implementado |

---

## Fase 3 — Completitud producto ✅

| ID | Hueco | Acción | Estado |
|----|-------|--------|--------|
| M1 | `inventario.transfer` sin feature | POST `/api/inventario/[id]/transferir` + UI modal | ✅ Implementado |
| M2 | Plantillas REMITO/NC sin emisión | NC vía anulación AFIP; remito sin flujo de negocio | ⏸ Diferido (ver `docs/12-PLANTILLAS-PDF.md`) |
| M3 | TARJETA/OTRO sin reglas | Cupón obligatorio en TARJETA; referencia/acreditación en OTRO | ✅ Implementado |
| M4 | Reglas inbox sin email | Cron `notificaciones-operativas` + emails en `ots-vencidas` (SLA) | ✅ Implementado |
| M8 | Filtros OT solo en UI | Query params en GET `/api/ots` (`q`, `estado`, `tecnicoId`, `sla`, …) | ✅ Implementado |

---

## Fase 4 — Documentación y polish ✅

| Ítem | Estado |
|------|--------|
| Sincronizar `docs/01-roles-y-permisos.md` con `lib/rbac.ts` | ✅ |
| Crons `stock-minimo`, `resumen-semanal` en mapa de módulos | ✅ `docs/22-MAPA-MODULOS.md` |
| 2FA fuera de alcance explícito | ✅ Nota en `docs/01-roles-y-permisos.md` |
| Script post-deploy permisos | ✅ `scripts/sync-permisos-post-deploy.ts` |

---

## Invariantes nuevas sugeridas

| ID | Regla | Test |
|----|-------|------|
| Co1 | Imputación ≤ saldo pendiente; factura en estado cobrable | `test-validar-cobranza-saldo.ts` |
| Co2 | Pago CHEQUE ⇒ fila `cheques_cobranza` | `integridad:prod` |
| Co3 | OC BORRADOR no recepcionable | API recibir |
| Co4 | Cheque rechazado ⇒ factura VENCIDA si cuota vencida | `test-cheque-rechazado-estado.ts` |
| Inv1 | Transferencia entre depósitos no altera stock global | `lib/inventario.ts` tipo `TRANSFERENCIA` |

---

## Deploy / operación

Tras cada cambio de RBAC:

```bash
npx tsx --env-file=.env scripts/sync-permisos-post-deploy.ts
# o scripts puntuales: sync-cheques-permisos.ts, sync-logs-permiso.ts
```

Re-login usuarios si cambió el set de permisos en sesión.

Migración pendiente en prod (Fase 2): `20260625100000_pago_anulado_conciliado`.

Ver también: `docs/INVARIANTES.md`, `npm run integridad:prod`.
