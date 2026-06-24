import { emailsAlertasDev, esUsuarioAlertasDev } from '../lib/dev/alertas-dev'

if (!esUsuarioAlertasDev({ email: 'admin@ib.com', roles: ['SUPERADMIN'] })) {
  throw new Error('admin@ib.com SUPERADMIN debe ver alertas dev')
}
if (esUsuarioAlertasDev({ email: 'admin@ib.com', roles: ['GERENTE'] })) {
  throw new Error('GERENTE no debe ver alertas dev')
}
if (esUsuarioAlertasDev({ email: 'gerente@ib.com', roles: ['SUPERADMIN'] })) {
  throw new Error('email no listado no debe ver alertas dev')
}

const emails = emailsAlertasDev()
if (!emails.includes('admin@ib.com')) throw new Error('default emails')

console.log('✅ esUsuarioAlertasDev OK')
console.log('\nOK — alertas dev\n')
