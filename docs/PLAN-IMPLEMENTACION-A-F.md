# Plan de implementación A–F (sin AFIP/ARCA)

> **Contexto:** AFIP/ARCA se resuelve mañana con el contador. Este plan avanza en paralelo sin tocar emisor PRODUCCIÓN ni certificados.  
> **Dominio:** erp-ibiomedica.com.ar · **Repo:** ibiomedica

---

## Orden de ejecución (de menor a mayor riesgo)

| Fase | Código | Opción | Objetivo | Riesgo |
|------|--------|--------|----------|--------|
| **0** | Doc | — | Commit guía `GO-LIVE-AFIP-VPS.md` | Ninguno |
| **1** | F | Infra | Verificación VPS, backup, crons, health | Bajo |
| **2** | E | Usuarios | Roles, audit permisos, guía operadores | Bajo |
| **3** | B | Datos | Import CSV artículos + mejoras import existentes | Medio |
| **4** | A | CRM | Setup prod IMAP/Graph, workers, smoke CRM | Medio |
| **5** | C | Operación | OT / inventario / compras polish | Medio |
| **6** | D | Reportes | IVA, aging cobranzas, OTs por técnico | Bajo |

**Regla:** cada fase pasa `npm run test:invariants` + `npm run build` antes de commit. Sin cambios en lógica AFIP de emisión.

---

## F — Infraestructura y tranquilidad

| # | Entregable | Criterio de done |
|---|------------|------------------|
| F1 | `scripts/vps-verify-infra.sh` | Health, PM2, cron file, último backup ≤24h |
| F2 | `npm run verify:infra` | Wrapper del script |
| F3 | Go-live check sección infra | WARN si backup viejo o cron ausente |
| F4 | Doc RUNBOOK § verificación infra | Comandos copy-paste |

---

## E — Usuarios y permisos

| # | Entregable | Criterio de done |
|---|------------|------------------|
| E1 | `audit:permisos` en go-live (WARN) | Roles sin permisos críticos |
| E2 | `docs/CAPACITACION-OPERADORES.md` | Por rol: vendedor, técnico, admin |
| E3 | Checklist usuarios en `/configuracion/usuarios` | Enlace a capacitación |

---

## B — Datos reales (importación)

| # | Entregable | Criterio de done |
|---|------------|------------------|
| B1 | `POST /api/inventario/import` + plantilla | SKU, nombre, stock, stockMinimo |
| B2 | UI import en `/inventario` | Igual patrón CRM/proveedores |
| B3 | Resumen import (creados/omitidos/errores) | Idempotente por SKU |
| B4 | Doc importación masiva | RUNBOOK § migración datos |

---

## A — CRM en producción

| # | Entregable | Criterio de done |
|---|------------|------------------|
| A1 | `docs/CRM-PRODUCCION-VPS.md` | IMAP/Graph/n8n paso a paso |
| A2 | `scripts/smoke-crm-inbox.ts` | Verifica config + último mensaje opcional |
| A3 | Go-live CRM mejorado | FAIL solo si config a medias |
| A4 | Test webhook n8n | `npm run smoke:n8n` si no existe |

---

## C — Operación diaria (OT / inventario / compras)

| # | Entregable | Criterio de done |
|---|------------|------------------|
| C1 | Filtro OTs por técnico/SLA en listado | Sin romper API existente |
| C2 | Inventario `?bajo=1` ya existe — badge nav Inventario | Paridad con Compras |
| C3 | Link OC desde inventario bajo mínimo | Reutiliza generar-oc |
| C4 | Invariante doc operación C1 | INVARIANTES.md |

---

## D — Reportes gestión

| # | Entregable | Criterio de done |
|---|------------|------------------|
| D1 | `GET /api/reportes/iva-mes` | CSV ventas por alícuota |
| D2 | `GET /api/reportes/aging-cobranzas` | CSV cuotas por antigüedad |
| D3 | `GET /api/reportes/ots-por-tecnico` | CSV OTs abiertas/cerradas mes |
| D4 | Centro `/reportes` actualizado | 3 exportaciones nuevas |

---

## Fuera de alcance (hasta AFIP con contador)

- Cambiar emisor a PRODUCCIÓN
- Primera factura fiscal real
- Certificados AFIP
- Homologación → producción

---

## Seguimiento

| Fase | Commit | Estado |
|------|--------|--------|
| 0 | `f71300c` | ✅ Completada |
| 1 F | `c3024d0` | ✅ Completada |
| 2 E | `8c0db34` | ✅ Completada |
| 3 B | `d2a04ee` | ✅ Completada |
| 4 A | (este run) | ✅ Completada |
| 5 C | (este run) | ✅ Completada |
| 6 D | (este run) | ✅ Completada |

Actualizar esta tabla al completar cada fase.
