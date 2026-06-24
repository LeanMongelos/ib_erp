# CRM en producción — VPS paso a paso

> Configurar bandeja de email (IMAP o Microsoft Graph) y webhooks n8n en **erp-ibiomedica.com.ar**.  
> Complementa [`05-crm-omnicanal.md`](05-crm-omnicanal.md) y [`RUNBOOK-PRODUCCION.md`](RUNBOOK-PRODUCCION.md).

---

## Resumen

| Canal | Worker PM2 | UI |
|-------|------------|-----|
| IMAP (Gmail, cPanel, etc.) | `worker-crm-email` | Configuración → Integraciones |
| Microsoft 365 / Outlook | `worker-crm-graph` | Configuración → Integraciones |
| n8n (WhatsApp, automatizaciones) | — (HTTP entrante) | Configuración → Integraciones + `N8N_API_KEY` |

---

## 1. Pre-requisitos en el VPS

```bash
cd /opt/ibiomedica
npm run go-live:check          # revisar sección CRM e Infraestructura
bash scripts/vps-start-workers.sh
pm2 status                     # worker-crm-email / worker-crm-graph online si aplica
```

---

## 2. Email IMAP

1. **Configuración → Integraciones → EMAIL_IMAP**
2. Completar: host IMAP, usuario, contraseña de aplicación, carpeta INBOX.
3. **Probar conexión** → estado debe quedar `CONECTADO`.
4. Verificar worker:
   ```bash
   pm2 logs worker-crm-email --lines 30
   ```
5. Smoke opcional:
   ```bash
   npm run smoke:crm
   ```

Variables alternativas en `.env` (si no usás la UI): `CRM_EMAIL_IMAP_HOST`, `CRM_EMAIL_IMAP_USER`, `CRM_EMAIL_IMAP_PASSWORD` — ver `.env.local.example`.

---

## 3. Microsoft Graph (Outlook / 365)

1. **Integraciones → EMAIL_GRAPH** — registrar app en Azure AD (tenant, client ID/secret).
2. **Autorizar OAuth** desde la UI del ERP.
3. Estado `CONECTADO` + worker:
   ```bash
   pm2 logs worker-crm-graph --lines 30
   npm run smoke:crm
   ```

---

## 4. n8n y webhooks

1. Definir `N8N_API_KEY` en `.env` (clave larga aleatoria).
2. **Integraciones → N8N** — URL del webhook y API key si aplica.
3. En n8n, llamar endpoints con header:
   ```
   Authorization: Bearer <N8N_API_KEY>
   ```
4. Verificar seguridad estática:
   ```bash
   npm run smoke:n8n
   ```

Rutas: `/api/n8n/*` — ver [`docs/11-API-ENDPOINTS.md`](11-API-ENDPOINTS.md).

---

## 5. Verificación post-configuración

```bash
npm run go-live:check    # CRM: PASS o WARN; FAIL si canal activo a medias
npm run smoke:crm        # config + último mensaje en BD (si hay)
curl -sf https://erp-ibiomedica.com.ar/api/health
```

En la UI: **CRM → Bandeja** — debe aparecer conversaciones tras la primera sincronización (puede tardar 1–2 ciclos de poll).

---

## 6. Troubleshooting

| Síntoma | Acción |
|---------|--------|
| Bandeja vacía | PM2 worker online · probar conexión Integraciones · logs `worker-crm-*` |
| OAuth Graph expirado | Re-autorizar en Integraciones |
| Webhook n8n 401 | Verificar `N8N_API_KEY` coincide en `.env` y n8n |
| FAIL go-live CRM | Completar credenciales o desactivar canal hasta tenerlas |

Runbook operativo: [`18-RUNBOOK-OPERACIONES.md`](18-RUNBOOK-OPERACIONES.md) §6.
