const fs = require('fs')
const path = require('path')

const transcriptPath = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/d-Ingenieria-Biomedica-ERP-ibiomedica/agent-transcripts/a261e467-b662-4870-b9ca-448271d8e8d3/a261e467-b662-4870-b9ca-448271d8e8d3.jsonl',
)
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n')
const line = lines[1030]
const start = line.indexOf('<!DOCTYPE html>')
if (start < 0) {
  console.error('HTML not found')
  process.exit(1)
}
let html = line.substring(start)
html = html.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
const end = html.indexOf('</html>')
if (end >= 0) html = html.substring(0, end + 7)
html = html.replace(/<img src="data:image[^"]+"([^>]*)>/g, '<img src="/logo.png"$1>')

const outPresupuesto = path.join(__dirname, '../lib/plantillas/html-presupuesto.html')
fs.writeFileSync(outPresupuesto, html, 'utf8')

let htmlFactura = html
  .replace(/Presupuesto \{\{presupuesto_numero\}\}/g, 'Factura {{factura_numero}}')
  .replace(/<title>Presupuesto \{\{presupuesto_numero\}\}<\/title>/g, '<title>Factura {{factura_numero}}</title>')
  .replace(/\{\{presupuesto_numero\}\}/g, '{{factura_numero}}')
  .replace(/\{\{presupuesto_fecha\}\}/g, '{{factura_fecha}}')
  .replace(/class="doc-invalido">Documento no válido como factura</, 'class="doc-invalido" style="display:none">Documento no válido como factura</')

const outFactura = path.join(__dirname, '../lib/plantillas/html-factura.html')
fs.writeFileSync(outFactura, htmlFactura, 'utf8')

console.log('Written presupuesto:', html.length, 'chars')
console.log('Written factura:', htmlFactura.length, 'chars')
