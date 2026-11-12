// CARGA: the web build for the Android and iPhone apps, copied into both native projects, and the
// same build as a live-update bundle (lib/live-update.js).
//   node scripts/build-app.mjs            build + cap sync (android and ios) + update bundle
//   node scripts/build-app.mjs android    only Android
// Then publish the site as usual with app-update-out/ copied to dist/app-update/: every installed
// app picks the new screens up on its own (no store review). A store release is only needed when
// something native changes (a new plugin or permission): then raise versionName in
// android/app/build.gradle (and the iOS version), and set CARGA_MIN_NATIVE to it, so older apps
// do not get a bundle they cannot run.
//
// The exercise animations are NOT packed into the app: it loads them from the site
// (carga-swart.vercel.app/exercise-media/...), so the app stays small and new animations reach it
// with the site's next deploy.
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const SITE = process.env.CARGA_SITE || 'https://carga-swart.vercel.app'
const MIN_NATIVE = process.env.CARGA_MIN_NATIVE || '1.0.0'
const d = new Date(), p = n => String(n).padStart(2, '0')
// a version that only grows: year.monthday.hourminute
const BUNDLE = `${d.getFullYear()}.${d.getMonth() + 1}${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}`
const env = {
  ...process.env,
  VITE_MOBILE: '1',
  VITE_LOCAL_WEB: '1',
  VITE_IMG_BASE: SITE + '/exercise-media/still/',
  VITE_GIF_BASE: SITE + '/exercise-media/clip/',
  VITE_UPDATE_FEED: SITE + '/app-update/latest.json',
  VITE_BUNDLE_ID: BUNDLE,
}
const run = cmd => execSync(cmd, { stdio: 'inherit', env, shell: true })
run('npx vite build --logLevel error')
const only = process.argv[2]
run('npx cap sync' + (only ? ' ' + only : ''))

// the live-update bundle: dist zipped (index.html at the root), its checksum and the feed
// (not on the iPhone build machine: CARGA_NO_BUNDLE=1; the bundle is made where the site is published)
if (process.env.CARGA_NO_BUNDLE) { console.log('app pronto (versão das telas ' + BUNDLE + ')'); process.exit(0) }
const out = path.resolve('app-update-out')
fs.mkdirSync(out, { recursive: true })
for (const f of fs.readdirSync(out)) if (f.endsWith('.zip') || f === 'latest.json') fs.unlinkSync(path.join(out, f))
const zip = path.join(out, `carga-${BUNDLE}.zip`)
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${path.resolve('dist')}\\*' -DestinationPath '${zip}' -Force"`, { stdio: 'inherit' })
const checksum = createHash('sha256').update(fs.readFileSync(zip)).digest('hex')
fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify({ version: BUNDLE, url: `${SITE}/app-update/carga-${BUNDLE}.zip`, checksum, native: MIN_NATIVE }, null, 2) + '\n')
console.log(`app pronto (versão das telas ${BUNDLE}); pacote de atualização em app-update-out/`)
