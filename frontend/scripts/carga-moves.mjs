// Sorts every catalogue exercise into the movement CARGA's figure performs for it
// (src/lib/carga-figure.js), reading its written instructions as well as its name, and writes
// the result to src/lib/carga-moves.json. The app ships the table, not the instructions' reading.
// Run again after the catalogue changes: node scripts/carga-moves.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyMove } from '../src/lib/carga-figure.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(here, '../../catalogue/exercises')
const out = {}
const count = {}
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const ex = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  const text = [ex.description, ...(ex.instructions || [])].filter(Boolean).join(' ')
  const move = classifyMove(ex, text)
  out[ex.id] = move
  count[move] = (count[move] || 0) + 1
}
fs.writeFileSync(path.join(here, '../src/lib/carga-moves.json'), JSON.stringify(out) + '\n')
console.log(Object.keys(out).length, 'exercises')
console.log(Object.entries(count).sort((a, b) => b[1] - a[1]).map(([m, n]) => m + ' ' + n).join(' · '))
