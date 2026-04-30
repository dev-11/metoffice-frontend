/**
 * Generates public/og-image.png — a static branded thumbnail.
 * Run manually when branding changes: node scripts/generate-og.mjs
 */

import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../public/og-image.png')

const W = 1200, H = 630
const col1x = 80, col2x = 640
const row1y = 370, row2y = 470
const pw = 480, ph = 74

const pill = (x, y, fill, stroke, textFill, label) => `
  <rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="37"
    fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  <text x="${x + pw / 2}" y="${y + 47}"
    font-family="system-ui,-apple-system,sans-serif" font-size="30" font-weight="600"
    fill="${textFill}" text-anchor="middle">${label}</text>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#e6f1fb"/>
      <stop offset="50%"  stop-color="#fef2f2"/>
      <stop offset="100%" stop-color="#fff7ed"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="1.5" fill="rgba(0,0,0,0.06)"/>
  </pattern>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <circle cx="980" cy="180" r="320" fill="rgba(255,255,255,0.35)"/>
  <circle cx="980" cy="180" r="220" fill="rgba(255,255,255,0.35)"/>
  <circle cx="980" cy="180" r="120" fill="rgba(255,255,255,0.4)"/>

  <text x="80" y="190"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="72" font-weight="700" fill="#44403c" letter-spacing="-1"
  >Orvosmeteorológia</text>

  <rect x="80" y="234" width="${W - 160}" height="1.5" rx="1" fill="#44403c" opacity="0.15"/>

  <text x="80" y="290"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="36" font-weight="400" fill="#78716c"
  >Napi frontjelzés és előrejelzés-előzmények</text>

  ${pill(col1x, row1y, '#e6f1fb', '#b5d4f4', '#0c447c', 'Hidegfront')}
  ${pill(col2x, row1y, '#fef2f2', '#fca5a5', '#991b1b', 'Melegfront')}
  ${pill(col1x, row2y, '#f1efe8', '#d3d1c7', '#444441', 'Nincs front')}
  ${pill(col2x, row2y, '#ede9fe', '#c4b5fd', '#5b21b6', 'Kettős front')}

  <text x="80" y="${H - 32}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="24" font-weight="400" fill="#44403c" opacity="0.55" letter-spacing="0.5"
  >idojaras.kutor.hu</text>
</svg>`

mkdirSync(resolve(__dirname, '../public'), { recursive: true })
await sharp(Buffer.from(svg)).png().toFile(OUT_PATH)
console.log(`[og] Saved → ${OUT_PATH}`)
