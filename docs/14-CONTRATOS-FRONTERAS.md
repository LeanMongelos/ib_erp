# 14 — Contratos, fronteras y convenciones de código

## 1. Cliente vs servidor (Next.js App Router)

### Regla

Todo archivo con `'use client'` **solo** puede importar módulos que no usen Node.js (`fs`, `path` hacia storage, Prisma directo en caliente, etc.).

### Mapa de módulos

| Módulo | Cliente | Servidor (API/RSC) |
|--------|---------|-------------------|
| `lib/errores.ts` | ✅ | ✅ |
| `lib/plantillas/binding-resolver.ts` | ✅ | ✅ |
| `lib/plantillas/media-url.ts` | ✅ | ✅ |
| `lib/plantillas/types.ts` | ✅ | ✅ |
| `lib/plantillas/palette.ts` | ✅ | ✅ |
| `lib/plantillas/resolve-binding.ts` | ✅ re-export seguro | ✅ |
| `lib/plantillas/resolve-image-src.server.ts` | ❌ | ✅ |
| `lib/plantillas/render-documento.tsx` | ❌ | ✅ |
| `lib/plantillas/build-datos.ts` | ❌ | ✅ |
| `lib/storage.ts` | ❌ | ✅ |
| `lib/prisma.ts` | ❌ | ✅ |
| `lib/serialize.ts` | ❌ | ✅ |
| `lib/api-auth.ts` | ❌ | ✅ |
| `lib/facturas/equipo-instalacion-client.ts` | ✅ | ✅ |
| `lib/facturas/validar-sucursal-equipo.ts` | ❌ | ✅ |
| `lib/clientes/validar-sucursales.ts` | ✅ | ✅ |

### Patrón validación cliente/servidor

Cuando la UI necesita la misma regla que el API pero el módulo server importa Prisma o `api-auth`, **extraer un archivo `*-client.ts`** sin dependencias de servidor.

Ejemplo: `equipo-instalacion-client.ts` (regla pura) → `validar-sucursal-equipo-client.ts` (re-export UI) y `validar-sucursal-equipo.ts` (POST `/api/facturas` con Prisma).

Sucursales de cliente: `validar-sucursales.ts` compartido entre `SucursalesEditor` y `clienteCreateSchema`.

### Error típico

```
Module not found: Can't resolve 'fs'
Import trace: PlantillasManager → PlantillaEditor → resolve-binding → storage
```

**Fix:** importar `binding-resolver` en cliente, no `resolve-binding` si este arrastra storage.

## 2. Contrato API ↔ UI

### Fetch cliente

```typescript
const res = await fetch('/api/...', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'Fallback español'))
```

### Respuesta exitosa

- JSON: objetos planos (`plain()`).
- PDF: `Content-Type: application/pdf` — usar `PdfPreviewFrame`, no `<iframe src="/api/...">` directo (X-Frame-Options DENY).

## 3. Validación (Zod)

- Schemas en cada `route.ts` o `lib/validation.ts`.
- Locale ES: `lib/zod-es.ts` importado al inicio de la app.
- Errores Zod traducidos en `handleApiError` vía `traducirMensajeInterno`.

## 4. RBAC

- Fuente de verdad permisos: `lib/rbac.ts` → `ROLE_PERMISSIONS`.
- Seed: `prisma/seed.ts` sincroniza `Permiso`, `RolRBAC`, `RolPermiso`.
- JWT incluye `permissions[]`; SUPERADMIN tiene `*`.
- **Gerente** incluye `config.manage_billing_templates`.

Al agregar permiso nuevo:

1. Entrada en `PERMISSIONS`.
2. Asignar a roles en `ROLE_PERMISSIONS`.
3. `requirePermission` en API.
4. `requirePagePermission` en page.tsx si aplica.
5. Re-seed o migración manual de `RolPermiso`.

## 5. Prisma

- **Siempre** `import { prisma } from '@/lib/prisma'`.
- Proxy invalida cliente tras `prisma generate` (HMR).
- `PRISMA_SCHEMA_VERSION` en `lib/prisma.ts` — incrementar al cambiar schema de forma incompatible.
- Transacciones para operaciones multi-tabla (predeterminado plantilla, emisor, etc.).

## 6. Storage de archivos

- Clave lógica: `plantillas/{id}/uuid.png`, `afip/{cuit}/certificado.crt`.
- Subida: `FormData` → API → `getStorage().put()`.
- Servir al browser: route dedicada (`/api/plantillas/media/...`).
- PDF: ruta filesystem vía `resolve-image-src.server.ts`.

## 7. Seguridad

- `lib/security/headers.ts` — CSP, X-Frame-Options DENY, etc.
- `lib/security/redact.ts` — oculta secretos en JSON al cliente.
- Certificados AFIP nunca en JSON al frontend.
- Webhooks/n8n: validar API key / verify token.

## 8. Convenciones UI

- Textos, toasts, labels: **español rioplatense**.
- Componentes: `components/ui/*` (Button, Card, Input…).
- Permisos UI: preferir `puedeEditar` desde server page + fallback `useCan`.
- Fechas: `formatFecha` desde `lib/utils.ts`.

## 9. Testing manual rápido

```bash
npm run smoke          # Prisma + rutas críticas
npx tsc --noEmit       # Types
npm run build          # Solo sin dev server corriendo
```

## 10. Anti-patrones (evitar)

| ❌ No hacer | ✅ Hacer |
|------------|---------|
| 3 previews PDF al montar página | Cola + delay + enabled flag |
| `useCan` como única guardia de página | `requirePagePermission` + prop |
| Importar `render-documento` en editor | POST preview con config |
| Commit `.env` / `storage/` | `.gitignore` |
| `Float` para importes nuevos | `Decimal` Prisma |
| Borrar factura EMITIDA | ANULADA + nota crédito |
