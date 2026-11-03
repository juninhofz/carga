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
// Whether exercises show CARGA's own animated figure (lib/carga-figure.js) instead of the shipped
// media, which this build does not carry. The test run turns it off, so the upstream media suites
// keep testing the stills and clips.
export const OWN_FIGURES = (ENV.VITE_OWN_FIGURES ?? '1') === '1'
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
