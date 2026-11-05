// The app's name and site, in one place. The source strings and every locale pack still say
// "openGym" (they are the i18n keys), so i18n-core.js t() swaps the name on the way out.
// VITE_APP_NAME overrides it: the test run sets it back to "openGym" (vite.config.js), so the
// upstream suites, which read the English strings, keep passing unchanged.
const ENV = import.meta.env || {}
export const APP_NAME = ENV.VITE_APP_NAME || 'CARGA'
// The language a copy starts in until someone picks one in Settings (lib/default-lang.js): ahead
// of the browser's own, with or without a server. VITE_DEFAULT_LANG overrides it; the test run
// sets it empty, so the upstream suites keep their browser-language behaviour.
export const BRAND_LANG = ENV.VITE_DEFAULT_LANG ?? 'pt-BR'
// Whether a translated exercise name also shows the English one in brackets, until someone sets
// it in Settings. CARGA shows the translation alone; the test run keeps the upstream default (on).
export const ENGLISH_NAME_HINT = ENV.VITE_ENGLISH_NAME_HINT === '1'
// openGym's own streak card, week and month recaps and "your year in openGym" on Home. CARGA has
// its rank, levels, missions and the challenges' medals in their place, so they are off; the code
// stays for a CARGA year in review later. The monthly challenges are not part of this: they count
// for the rank. The test run turns them on, as upstream has them.
export const OPENGYM_EXTRAS = (ENV.VITE_OPENGYM_EXTRAS ?? '0') === '1'
// The languages offered in Settings. The other packs stay in the app (a phone set to one of them
// still gets it), only the choice is shorter: CARGA is written in Brazilian Portuguese. The test
// run sets it empty, which offers every language as upstream does.
export const SHOWN_LANGS = (ENV.VITE_SHOWN_LANGS ?? 'pt-BR,en,es').split(',').map(x => x.trim()).filter(Boolean)
// Whether a finished activity is kept as it was: no editing, no new date or duration, no deleting
// (a workout or a run counts for the rank and the challenges, so its record stays). The test run
// turns it off, so the upstream suites keep testing the edits.
export const LOCKED_HISTORY = (ENV.VITE_LOCKED_HISTORY ?? '1') === '1'
// Where this build's source code is published, as the AGPL asks (Settings → About).
export const SOURCE_URL = ENV.VITE_SOURCE_URL || 'https://github.com/juninhofz/carga'
// The address printed on share cards; empty draws none.
export const SITE = ''

// "openGym" in a translated string becomes APP_NAME. A path (Documents/openGym) is left alone:
// it names the real folder the Android backup writes to (lib/mobile.js AUTO_BACKUP_DIR).
export const brandText = (s, name = APP_NAME) => (typeof s === 'string' ? s.replace(/(?<![/\w])openGym/g, name) : s)

// The chart range buttons (1M, 3M, 1Y, 30d) are written as abbreviations, outside t(). In
// Portuguese a year is "ano" and a day "dia": 1A, 30 d.
const PT_PERIODS = { '1M': '1M', '3M': '3M', '1Y': '1A', '30d': '30 d', '90d': '90 d' }
export const periodLabel = (label, lang = typeof document !== 'undefined' ? document.documentElement.lang : '') =>
  (String(lang).startsWith('pt') && PT_PERIODS[label]) || label
