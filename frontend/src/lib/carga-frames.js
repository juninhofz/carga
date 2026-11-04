// CARGA's own exercise drawings: the anime character, three frames per exercise (start, middle,
// end), in public/carga-frames/<id>-<0|1|2>.webp. An exercise listed here shows them in place of
// the shipped clip; every other exercise keeps its clip. The frames play start, middle, end,
// middle, so the movement goes down and back up.
export const FRAMES = new Set(['0043', '0294', '0662'])
export const FRAME_ORDER = [0, 1, 2, 1]
export const FRAME_MS = 520
const BASE = (import.meta.env?.BASE_URL || '/') + 'carga-frames/'
export const hasFrames = ex => !!ex && FRAMES.has(ex.id)
export const frameSrc = (ex, i) => BASE + ex.id + '-' + i + '.webp'
