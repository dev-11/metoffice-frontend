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

  <text x="80" y="200"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="72" font-weight="700" fill="#44403c"
    letter-spacing="-1"
  >Orvosmeteorológia</text>

  <rect x="80" y="228" width="120" height="4" rx="2" fill="#44403c" opacity="0.2"/>

  <text x="80" y="310"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="36" font-weight="400" fill="#78716c"
  >Napi frontjelzés és előrejelzés-előzmények</text>

  <rect x="80"  y="390" width="180" height="52" rx="26" fill="#e6f1fb"/>
  <text x="170" y="424" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="600" fill="#0c447c" text-anchor="middle">Hidegfront</text>

  <rect x="278" y="390" width="180" height="52" rx="26" fill="#fef2f2"/>
  <text x="368" y="424" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="600" fill="#991b1b" text-anchor="middle">Melegfront</text>

  <rect x="476" y="390" width="160" height="52" rx="26" fill="#f1efe8"/>
  <text x="556" y="424" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="600" fill="#444441" text-anchor="middle">Nincs front</text>

  <rect x="654" y="390" width="160" height="52" rx="26" fill="#ede9fe"/>
  <text x="734" y="424" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="600" fill="#5b21b6" text-anchor="middle">Kettős front</text>
</svg>`

mkdirSync(resolve(__dirname, '../public'), { recursive: true })
await sharp(Buffer.from(svg)).png().toFile(OUT_PATH)
console.log(`[og] Saved → ${OUT_PATH}`)
