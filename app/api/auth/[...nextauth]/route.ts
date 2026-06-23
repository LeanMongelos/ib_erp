import NextAuth from 'next-auth'
import { authOptions, getAuthOptions } from '@/lib/auth'

type AuthHandler = ReturnType<typeof NextAuth>

let cachedHandler: AuthHandler | null = null
let cachedMaxAge: number | null = null

async function resolveHandler(): Promise<AuthHandler> {
  try {
    const options = await getAuthOptions()
    const maxAge = options.session?.maxAge ?? null
    if (!cachedHandler || cachedMaxAge !== maxAge) {
      cachedHandler = NextAuth(options)
      cachedMaxAge = maxAge
    }
    return cachedHandler
  } catch (err) {
    console.error('[nextauth] No se pudo leer política de sesión, usando fallback:', err)
    if (!cachedHandler) {
      cachedHandler = NextAuth(authOptions)
      cachedMaxAge = authOptions.session?.maxAge ?? null
    }
    return cachedHandler
  }
}

async function handler(
  req: Request,
  context: { params: { nextauth: string[] } },
) {
  return (await resolveHandler())(req, context)
}

export { handler as GET, handler as POST }
