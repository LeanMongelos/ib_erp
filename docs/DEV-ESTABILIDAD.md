# Estabilidad en desarrollo local

Si la app se ve **sin estilos** (tipografía Times, menú plano, elementos superpuestos) o aparecen errores como `Cannot find module './8948.js'`, el problema casi siempre es la **caché de Next.js corrupta** (carpeta `.next`), no un bug de negocio.

## Síntomas

- UI sin CSS (parece HTML crudo)
- Errores en consola: `GET /_next/static/css/... 500`
- `Cannot find module './XXXX.js'` en terminal
- Pantallas que funcionaban y dejan de funcionar sin cambiar código
- Errores de Prisma: `prisma.alicuotaIva undefined` (cliente viejo en memoria)

## Causas habituales en este proyecto

| Causa | Por qué pasa |
|-------|----------------|
| **Caché `.next` corrupta** | HMR de Next en Windows + muchos cambios de archivos seguidos |
| **Varios `npm run dev` a la vez** | Varios procesos pelean por `.next` y el mismo puerto |
| **Conflicto con otra web en :3000** | `dev-start.js` antes mataba **todo** el 3000 — ahora iBiomédica usa **3001** por defecto |
| **`npm run build` con dev corriendo** | Sobrescribe chunks que el dev server espera |
| **Cambios en `schema.prisma` sin reiniciar** | Cliente Prisma en memoria queda obsoleto |
| **No correr `prisma generate` tras pull/migrate** | Modelos nuevos no existen en runtime |

## Solución rápida (recomendada)

**Síntoma:** UI sin estilos (Times New Roman, menú vertical, links azules).

```bash
npm run dev:reset
```

Luego **Ctrl+Shift+R** en el navegador.

Esto: mata procesos en el **puerto del ERP** (`PORT` en `.env`, default **3001**), borra `.next` completo, regenera Prisma e inicia dev limpio.

## Convivir con otra web local

| App | Puerto típico |
|-----|----------------|
| Otra web / Next | **3000** |
| **iBiomédica ERP** | **3001** (`PORT=3001` en `.env`) |

`npm run dev` **solo libera el puerto 3001** — no mata tu otra app en 3000.

Verificar estado:

```bash
npm run dev:status
```

URL del ERP: **http://localhost:3001** (debe coincidir con `NEXTAUTH_URL` en `.env`).

## Prevención (desde jun 2026)

`npm run dev` usa `scripts/dev-start.js`:
- Libera solo el puerto configurado (`PORT`, default 3001).
- **No** borra caché webpack en cada arranque (más rápido). Reset: `npm run dev:reset`.

Arranque directo sin matar puerto: `npm run dev:fast`.

## Solución rápida (alternativa manual)

```bash
# Ctrl+C en todas las terminales con next dev
# Luego:
Remove-Item -Recurse -Force .next   # PowerShell
npx prisma generate
npm run dev
```

## Buenas prácticas

1. **Un solo dev server** — cerrá terminales viejas antes de arrancar otro.
2. Tras **`prisma migrate`** o **`git pull` con schema nuevo**: `npx prisma generate` + reiniciar dev.
3. No ejecutar **`npm run build`** mientras **`npm run dev`** está activo.
4. Verificación rápida: `npm run smoke` (Prisma + contabilidad) y `npm run e2e` (CRM, sucursales, historial, geocoding).
5. Producción local estable: `npm run build && npm run start` (no usa HMR).

## Typecheck y scripts

- `npx tsc --noEmit` — el build Next excluye `scripts/` vía `tsconfig.json` (`exclude: ["scripts"]`).
- Scripts de prueba:
  - `npm run smoke` → `scripts/e2e-smoke.ts`
  - `npm run e2e` → `scripts/e2e-revision.ts`
  - `npm run e2e:all` → ambos
- Demo CRM: `npx tsx --env-file=.env scripts/demo-historial-graciela.ts`

## Producción

En producción (`npm run start`) estos problemas **no ocurren**: el build genera `.next` completo una sola vez. La inestabilidad es del **modo desarrollo** con recarga en caliente.
