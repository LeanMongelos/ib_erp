/**
 * Tests búsqueda flexible de texto.
 */
import {
  distanciaLevenshtein,
  normalizarTextoBusqueda,
  quitarAcentos,
  textoContieneBusqueda,
  tokenizarBusqueda,
  tokensCoincidenFuzzy,
  umbralLevenshtein,
} from '../lib/texto-busqueda'

const errors: string[] = []

function pass(msg: string) {
  console.log('✅', msg)
}

function fail(msg: string) {
  errors.push(msg)
  console.error('❌', msg)
}

function main() {
  console.log('\n=== Test texto búsqueda ===\n')

  if (quitarAcentos('Aerocámara') === 'Aerocamara') pass('quitar acentos Aerocámara')
  else fail('quitar acentos Aerocámara')

  if (normalizarTextoBusqueda('  ÓXIGENO ') === 'oxigeno') pass('normalizar ÓXIGENO')
  else fail('normalizar ÓXIGENO')

  if (tokenizarBusqueda('equipo resmed').join(',') === 'equipo,resmed') pass('tokenizar palabras')
  else fail('tokenizar palabras')

  if (distanciaLevenshtein('aerocamra', 'aerocamara') === 1) pass('levenshtein aerocamra')
  else fail('levenshtein aerocamra')

  if (umbralLevenshtein(9) === 2 && umbralLevenshtein(5) === 1) pass('umbral por longitud')
  else fail('umbral por longitud')

  if (
    tokensCoincidenFuzzy(normalizarTextoBusqueda('Aerocámara adulto PA05'), 'aerocamra')
  ) {
    pass('fuzzy aerocamra → Aerocámara')
  } else fail('fuzzy aerocamra → Aerocámara')

  if (
    textoContieneBusqueda(['Monitor UCI Resmed'], 'resmed')
  ) {
    pass('coincide resmed sin acento en nombre')
  } else fail('coincide resmed')

  if (
    textoContieneBusqueda(['Monitor UCI Resmed AirSense 10'], 'resme')
  ) {
    pass('typo resme → resmed')
  } else fail('typo resme → resmed')

  if (
    textoContieneBusqueda(['Aerocámara adulto PA05'], 'aerocamara')
  ) {
    pass('aerocamara encuentra Aerocámara (exacto)')
  } else fail('aerocamara vs Aerocámara')

  if (
    textoContieneBusqueda(['Aerocámara adulto PA05'], 'aerocamra')
  ) {
    pass('aerocamra encuentra Aerocámara (typo)')
  } else fail('aerocamra vs Aerocámara (typo)')

  if (
    !textoContieneBusqueda(['Filtro HEPA'], 'monitor')
  ) {
    pass('no coincide falso positivo monitor')
  } else fail('falso positivo monitor')

  if (
    !textoContieneBusqueda(['Aerocámara adulto PA05'], 'aeroxxx')
  ) {
    pass('no coincide typo demasiado lejano')
  } else fail('typo demasiado lejano no debe coincidir')

  console.log('')
  if (errors.length > 0) {
    console.error(`${errors.length} fallo(s).\n`)
    process.exit(1)
  }
  console.log('OK — texto búsqueda\n')
}

main()
