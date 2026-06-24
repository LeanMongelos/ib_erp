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

## Fase 2 — Estado y operación (en curso)

| ID | Hueco | Acción propuesta | Estado |
|----|-------|------------------|--------|
| C1 | Anulación / NC AFIP | `POST /api/facturas/[id]/anular` + NC + `anularVencimientosPendientes` | ✅ Implementado |
| H3 | `cobranzas.reconcile` sin UI | Conciliación mínima o retirar permiso | pendiente |
| H9 | Cheque duplicado / ANULADO | Unique `(numero,banco)` + acción anular | ✅ Implementado |
| H10 | OT sin máquina de estados | `lib/ots/transiciones.ts` compartido UI/API |
| H12 | Health cola AFIP | Alerta en integridad si worker caído |
| — | Reversión pagos transferencia | PATCH anular pago no-cheque |

---

## Fase 3 — Completitud producto

| ID | Hueco | Acción |
|----|-------|--------|
| M1 | `inventario.transfer` sin feature | Implementar o quitar permiso |
| M2 | Plantillas REMITO/NC sin emisión | Decisión producto |
| M3 | TARJETA/OTRO sin reglas | Campos cupón / acreditación |
| M4 | Reglas inbox sin email | Cron por evento (OT SLA, preventivo) |
| M8 | Filtros OT solo en UI | Query params en GET `/api/ots` |

---

## Fase 4 — Documentación y polish

- Sincronizar `docs/01-roles-y-permisos.md` con `lib/rbac.ts`
- Listar crons `stock-minimo`, `resumen-semanal` en mapa de módulos
- 2FA: implementar o marcar explícitamente fuera de alcance
- Script genérico post-deploy: sync permisos nuevos desde `PERMISSIONS` (sin pisar custom UI)

---

## Invariantes nuevas sugeridas

| ID | Regla | Test |
|----|-------|------|
| Co1 | Imputación ≤ saldo pendiente; factura en estado cobrable | `test-validar-cobranza-saldo.ts` |
| Co2 | Pago CHEQUE ⇒ fila `cheques_cobranza` | `integridad:prod` |
| Co3 | OC BORRADOR no recepcionable | API recibir |
| Co4 | Cheque rechazado ⇒ factura VENCIDA si cuota vencida | unit en cheques |

---

## Deploy / operación

Tras cada cambio de RBAC: `scripts/sync-cheques-permisos.ts` (incluye emisores.create) + re-login usuarios.

Ver también: `docs/INVARIANTES.md`, `npm run integridad:prod`.
