/**
 * Conversión HTML → PDF con Puppeteer. Server-only.
 */
import fs from 'fs'
import path from 'path'
import type { Browser } from 'puppeteer'

function inlineLogo(html: string): string {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png')
  if (!fs.existsSync(logoPath)) return html
  const data = fs.readFileSync(logoPath).toString('base64')
  return html.replace(/src="\/logo\.png"/g, `src="data:image/png;base64,${data}"`)
}

async function launchBrowser(): Promise<Browser> {
  const { default: puppeteer } = await import('puppeteer')
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
}

export async function htmlToPdf(html: string, papel: 'A4' | 'LETTER' = 'A4'): Promise<Buffer> {
  const htmlReady = inlineLogo(html)
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(htmlReady, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: papel === 'LETTER' ? 'Letter' : 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
