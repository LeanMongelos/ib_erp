import { validarTransicionOT, transicionesOTPermitidas } from '../lib/ots/transiciones-client'

if (validarTransicionOT('ABIERTA', 'EN_PROCESO') !== null) throw new Error('ABIERTA→EN_PROCESO')
if (validarTransicionOT('ABIERTA', 'CERRADA') === null) throw new Error('ABIERTA→CERRADA inválido')
if (validarTransicionOT('EN_PROCESO', 'CERRADA') !== null) throw new Error('EN_PROCESO→CERRADA')
if (validarTransicionOT('VENCIDA', 'EN_PROCESO') !== null) throw new Error('VENCIDA→EN_PROCESO')
if (validarTransicionOT('CERRADA', 'ABIERTA') === null) throw new Error('CERRADA terminal')
if (validarTransicionOT('CANCELADA', 'ABIERTA') !== null) throw new Error('CANCELADA→ABIERTA')
if (transicionesOTPermitidas('CANCELADA').join(',') !== 'ABIERTA') throw new Error('CANCELADA→ABIERTA única')

console.log('✅ transiciones OT OK')
console.log('\nOK — OT transiciones\n')
