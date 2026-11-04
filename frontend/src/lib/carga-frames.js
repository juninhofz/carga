// CARGA's own exercise drawings: the anime character, three frames per exercise (start, middle,
// end), in public/carga-frames/<id>-<0|1|2>.webp. An exercise listed here shows them in place of
// the shipped clip; every other exercise keeps its clip. The frames play start, middle, end,
// middle, so the movement goes down and back up; where the middle came out the same as the end,
// only start and end take turns.
const FULL = [0, 1, 2, 1]
const ENDS = [0, 2]
export const FRAMES = {
  '0043': FULL, // barbell full squat
  '0294': FULL, // dumbbell biceps curl
  '0662': FULL, // push-up
  '0198': FULL, // cable pulldown
  '0085': FULL, // barbell romanian deadlift
  '0314': FULL, // dumbbell incline bench press
  '0586': FULL, // lever lying leg curl
  '0027': FULL, // barbell bent over row
  '0334': FULL, // dumbbell lateral raise
  '0861': FULL, // cable seated row
  '0405': FULL, // dumbbell seated shoulder press
  '0585': FULL, // lever leg extension
  '2267': FULL, // lever seated leg press
  '0032': ENDS, // barbell deadlift
  '0025': FULL, // barbell bench press
  '0200': FULL, // cable pushdown (with rope attachment)
  '0652': ENDS, // pull-up
  '0313': ENDS, // dumbbell hammer curl
  '0319': ENDS, // dumbbell incline fly
}
export const FRAME_MS = 520
const BASE = (import.meta.env?.BASE_URL || '/') + 'carga-frames/'
export const hasFrames = ex => !!ex && Object.hasOwn(FRAMES, ex.id)
export const frameOrder = ex => FRAMES[ex.id] || FULL
export const frameSrc = (ex, i) => BASE + ex.id + '-' + i + '.webp'
