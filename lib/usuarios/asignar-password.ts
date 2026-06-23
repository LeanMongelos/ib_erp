import bcrypt from 'bcryptjs'
import { ApiError } from '@/lib/api-auth'
import {
  obtenerPoliticaSeguridad,
  validarPasswordSegunPolitica,
} from '@/lib/config/politica-seguridad'

export async function validarYHashearPassword(password: string): Promise<string> {
  const politica = await obtenerPoliticaSeguridad()
  const errorPolitica = validarPasswordSegunPolitica(password, politica)
  if (errorPolitica) throw new ApiError(400, errorPolitica)
  return bcrypt.hash(password, 10)
}

export function validarConfirmacionPassword(
  password: string | undefined,
  confirmarPassword: string | undefined,
): void {
  if (!password) return
  if (password !== confirmarPassword) {
    throw new ApiError(400, 'Las contraseñas no coinciden')
  }
}
