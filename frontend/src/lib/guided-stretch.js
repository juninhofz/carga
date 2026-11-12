// CARGA: the guided stretch ("Alongar agora", the daily "Alongue-se 5 minutos"). A routine of its
// own, eight stretches of 30 seconds each, run as a workout whose timed holds start by themselves
// (lib/auto-holds.js): 3, 2, 1, hold, the next one. So it gets everything a workout has: the
// lock-screen panel with Next and Pause, the voice in the earphones at every step ("Prepare-se:
// …", "Já! …", "Feito: …"), and the history. Completing it counts for the daily mission, like any
// stretching (lib/carga-level.js mobility).
export const STRETCH_ROUTINE_ID = 'carga-alongamento-guiado'
const HOLD_SEC = 30
const BETWEEN_SEC = 5

// whole body, no equipment, standing or on the floor: neck, shoulders, chest, spine, belly, hips,
// inner thighs, calves (exercise ids of the catalogue, all in the 'stretching' category)
export const STRETCHES = ['4509', '1793', '1777', '1051', '3244', '4296', '4512', '1407']

export function stretchRoutine() {
  return {
    id: STRETCH_ROUTINE_ID,
    name: '🧘 Alongamento guiado',
    emoji: 'stretch',
    ex: STRETCHES.map(id => ({ id, sets: 1, mode: 'time', sec: HOLD_SEC, weight: 0, bodyweight: true, restSec: BETWEEN_SEC, autoHold: true })),
  }
}

/** Puts the routine in the profile (or brings it back to its first form) inside an update(). */
export function ensureStretchRoutine(s) {
  s.routines = Array.isArray(s.routines) ? s.routines : []
  const r = stretchRoutine()
  const i = s.routines.findIndex(x => x.id === STRETCH_ROUTINE_ID)
  if (i >= 0) s.routines[i] = { ...s.routines[i], ex: r.ex }
  else s.routines.push(r)
}
