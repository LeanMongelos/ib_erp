import { redirect } from 'next/navigation'

export default function CrmNuevoClienteRedirect() {
  redirect('/clientes/nuevo')
}
