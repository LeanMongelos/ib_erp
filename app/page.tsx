import { redirect } from 'next/navigation'

// Redirige la raíz al dashboard (o login si no hay sesión)
export default function RootPage() {
  redirect('/dashboard')
}
