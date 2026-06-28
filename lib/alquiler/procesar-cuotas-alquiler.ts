import { generarCuotasMesAlquiler } from '@/lib/alquiler/generar-cuotas-mes'
import { marcarCuotasAlquilerVencidas } from '@/lib/alquiler/marcar-cuotas-vencidas'

export async function procesarCuotasAlquilerDelDia(fechaRef = new Date()) {
  const generacion = await generarCuotasMesAlquiler(fechaRef)
  const vencidas = await marcarCuotasAlquilerVencidas(fechaRef)
  return { ...generacion, cuotasMarcadasVencidas: vencidas }
}
