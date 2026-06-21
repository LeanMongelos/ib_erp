# Reglas de interfaz — Español (Argentina)

Este ERP está pensado para operadores, contadores y técnicos en Argentina. **Todo lo que ve el usuario debe estar en español.**

## Alcance

Aplica a textos visibles en:

- Componentes React (`components/`, `app/(dashboard)/`)
- Mensajes de toast, errores y validaciones mostrados al usuario
- Etiquetas de formularios, columnas de tablas, botones, tooltips, placeholders
- Títulos de páginas y subtítulos del `Header`

**No aplica** a: nombres de variables, campos de API, enums en código, comentarios técnicos, documentación para desarrolladores (salvo que sea manual de usuario).

## Prohibido en la UI

No usar términos en inglés cuando exista equivalente claro en español. Ejemplos:

| ❌ Evitar | ✅ Usar |
|----------|---------|
| Lead time | Plazo de entrega |
| Default | Predeterminado / por defecto |
| Save / Cancel / Delete | Guardar / Cancelar / Eliminar |
| Loading | Cargando… |
| Submit | Enviar / Guardar |
| Search | Buscar |
| Status | Estado |
| Pending | Pendiente |
| Active / Inactive | Activo / Inactivo |
| Dashboard (como label) | Panel / Tablero |
| Settings | Configuración |
| Export | Exportar |
| Upload | Subir / Cargar archivo |
| Branch / Installation site | Sucursal / sede de instalación |
| Geocoding / Map validation | Validación en mapa |

## Convenciones Argentina

- Moneda: **ARS**, **USD** (siglas internacionales aceptadas en contexto fiscal/comercial).
- Fechas en UI: `dd/MM/yyyy`.
- Impuestos y AFIP: nomenclatura local (IVA, IIBB, CUIT, RI, etc.).

## Nombres de código vs UI

Los identificadores en TypeScript/Prisma pueden permanecer en inglés (`leadTimeDias`, `isDefault`). Solo traducir **strings que renderiza la interfaz**:

```tsx
// ✅ Correcto
<label>Plazo de entrega (días)</label>
const leadTimeDias = … // nombre de variable OK

// ❌ Incorrecto
<label>Lead time (days)</label>
```

## Manejo de errores

Todo mensaje de error visible al usuario (toasts, alertas, validaciones de formulario) debe estar en **español** y usar el módulo central `@/lib/errores`:

| Helper | Uso |
|--------|-----|
| `mensajeErrorJson(json, fallback)` | Extraer mensaje de `{ error: string }` o detalles Zod en respuestas ya parseadas |
| `mensajeErrorRespuesta(res, fallback)` | Async — leer JSON de un `Response` fallido |
| `mensajeErrorDesconocido(err, fallback)` | En bloques `catch` antes de mostrar toast |
| `lanzarErrorApi(json, fallback)` | Lanzar `Error` con mensaje en español |
| `traducirMensajeInterno(msg)` | Traducir mensajes técnicos en inglés (solo en capa API/servidor) |

**Patrones obligatorios:**

```tsx
import { mensajeErrorJson, mensajeErrorDesconocido, mensajeErrorRespuesta } from '@/lib/errores'

// Respuesta fallida (JSON ya parseado)
if (!res.ok) throw new Error(mensajeErrorJson(data, 'No se pudo …'))

// Respuesta fallida (async)
if (!res.ok) throw new Error(await mensajeErrorRespuesta(res, 'No se pudo …'))

// Catch
catch (e) {
  toast.error(mensajeErrorDesconocido(e, 'No se pudo …'))
}
```

- Usar **fallbacks contextuales** en español (nunca `'Error'` genérico).
- En rutas API, `handleApiError` de `@/lib/api-auth` ya traduce Zod y errores 500.
- Zod se configura en español al importar `@/lib/errores` (vía `@/lib/validation`).

## Revisión antes de merge

Al tocar pantallas de usuario, buscar en el diff strings en inglés en JSX (`label=`, `placeholder=`, headers de tabla, `toast.*`).

Comando útil:

```bash
rg -i "lead time|loading|submit|cancel|delete|default|search|status|pending" components app --glob "*.tsx"
```

## Referencia para agentes Cursor

Regla automática del proyecto: `.cursor/rules/ui-espanol.mdc`
