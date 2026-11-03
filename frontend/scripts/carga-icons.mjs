#!/usr/bin/env node
/* The CARGA icon (lib/carga-mark.js) as files:
 *   resources/carga-icon.svg      the source, 512 px square
 *   public/icon-512.png           PWA icon (manifest.json)
 *   public/icon-180.png           apple-touch-icon and favicon (index.html)
 *
 * The PNGs are rendered by a headless Edge or Chrome: set BROWSER to its path when it is not in
 * the usual Windows place. The native Android/iOS icons and the Settings → App icon set are not made here yet
 * (scripts/app-icons.mjs and @capacitor/assets still draw the old glyph; docs/MOBILE.md).
 *
 * Usage: node scripts/carga-icons.mjs */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { markSVG, COLORS } from '../src/lib/carga-mark.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// The mark takes about 70% of the icon's height: room for the rounded corners phones cut.
const ICON_VIEWBOX = '-30 -30 300 300'

export function iconSVG(size = 512) {
  const mark = markSVG({ viewBox: ICON_VIEWBOX, ground: COLORS.ground })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<rect width="${size}" height="${size}" fill="${COLORS.ground}"/>`
    + mark.replace('<svg ', `<svg width="${size}" height="${size}" `)
    + '</svg>'
}

const BROWSERS = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean)

function renderPng(size, out) {
  const browser = BROWSERS.find(existsSync)
  if (!browser) throw new Error('No Edge or Chrome found: set BROWSER to one')
  const dir = mkdtempSync(join(tmpdir(), 'carga-icon-'))
  const page = join(dir, 'icon.html')
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:${COLORS.ground}}svg{display:block}</style>${iconSVG(size)}`)
  const r = spawnSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${join(dir, 'profile')}`, `--window-size=${size},${size}`, `--screenshot=${out}`, pathToFileURL(page).href], { stdio: 'ignore' })
  rmSync(dir, { recursive: true, force: true })
  if (r.status !== 0 || !existsSync(out)) throw new Error('Rendering ' + out + ' failed')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(join(ROOT, 'resources/carga-icon.svg'), iconSVG(512) + '\n')
  for (const [size, file] of [[512, 'public/icon-512.png'], [180, 'public/icon-180.png']]) {
    renderPng(size, join(ROOT, file))
    console.log('wrote', file)
  }
}
