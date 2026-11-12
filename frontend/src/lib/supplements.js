// CARGA: the person's supplements and their reminders ("Hora da creatina").
// S.supplements = [{ id, name, amount, perDay, times: ['08:00', ...], every: 1|2|3|7|'train', remind, start }]
//   every: 1 every day, 2 every other day, 3 every third day, 7 once a week, 'train' gym days only
//   start: the first day (YYYY-MM-DD) the every-N-days count runs from
// The reminders are one-off phone notifications for the next WINDOW days, scheduled again every
// time the app comes back (lib/mobile.js initReminderSync), the same way the workout reminder is.

export const CATALOG = [
  { id: 'creatine', f: true, name: 'Creatina', icon: '⚡', amount: '5 g', at: { any: ['08:00'] } },
  { id: 'whey', name: 'Whey', icon: '🥛', amount: '1 dose', at: { morning: ['09:00'], afternoon: ['16:00'], night: ['21:00'], any: ['16:00'] } },
  { id: 'preworkout', name: 'Pré-treino', icon: '🔥', amount: '1 dose', at: { morning: ['06:30'], afternoon: ['14:30'], night: ['18:30'], any: ['17:30'] }, train: true },
  { id: 'multi', name: 'Multivitamínico', icon: '💊', amount: '1 cápsula', at: { any: ['08:00'] } },
  { id: 'omega3', name: 'Ômega 3', icon: '🐟', amount: '1 cápsula', at: { any: ['13:00'] } },
  { id: 'vitd', f: true, name: 'Vitamina D', icon: '☀️', amount: '1 cápsula', at: { any: ['08:00'] } },
  { id: 'caffeine', f: true, name: 'Cafeína', icon: '☕', amount: '1 cápsula', at: { any: ['07:00'] } },
  { id: 'collagen', name: 'Colágeno', icon: '✨', amount: '1 dose', at: { any: ['22:00'] } },
  { id: 'bcaa', name: 'BCAA', icon: '💧', amount: '1 dose', at: { any: ['17:00'] }, train: true },
  { id: 'glutamine', f: true, name: 'Glutamina', icon: '🌙', amount: '5 g', at: { any: ['22:00'] } },
  { id: 'mass', name: 'Hipercalórico', icon: '🍌', amount: '1 dose', at: { any: ['10:00', '16:00'] } },
  { id: 'other', name: 'Outro', icon: '✏️', amount: '', at: { any: ['08:00'] } },
]
export const CAT = Object.fromEntries(CATALOG.map(c => [c.id, c]))
export const EVERY = [[1, 'Todo dia'], [2, 'Dia sim, dia não'], [3, 'A cada 3 dias'], [7, '1 vez por semana'], ['train', 'Só nos dias de treino']]

const pad = n => String(n).padStart(2, '0')
export const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const minutes = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null }
const hhmm = m => pad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) + ':' + pad(((m % 1440) + 1440) % 1440 % 60)

/** The times a supplement is taken, `n` a day, starting from the first one and spread over the day. */
export function spreadTimes(first, n) {
  const f = minutes(first) ?? 480
  if (n <= 1) return [hhmm(f)]
  const gap = n === 2 ? 600 : 300                       // twice: 10 h apart; three times: 5 h apart
  return Array.from({ length: n }, (_, i) => hhmm(Math.min(f + i * gap, 23 * 60 + 30)))
}

/** A new supplement from the catalogue, its times fitted to when the person trains. */
export function newSupplement(id, timeOfDay = 'any', today = isoOf(new Date())) {
  const c = CAT[id] || CAT.other
  const times = c.at[timeOfDay] || c.at.any
  return { id: id === 'other' ? 'other-' + Date.now().toString(36) : id, kind: c.id, name: id === 'other' ? '' : c.name, amount: c.amount, perDay: times.length, times: [...times], every: c.train ? 'train' : 1, remind: true, start: today }
}

const dayDiff = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000)
/** Whether supplement `s` is due on `iso` (the gym days come from the week plan, S.week). */
export function dueOn(s, iso, S) {
  if (s.every === 'train') {
    const dow = new Date(iso + 'T12:00:00').getDay()
    const day = S?.week?.[dow]
    return Array.isArray(day) && day.length > 0
  }
  const n = Number(s.every) || 1
  const d = dayDiff(s.start || iso, iso)
  return d >= 0 && d % n === 0
}

export const WINDOW = 14
const ID_BASE = 7300                                     // 7300 + day × 20 + dose: clear of the app's other ids
const PER_DAY_IDS = 20
export const nameOf = s => s.name || CAT[s.kind]?.name || 'Suplemento'
// 'Creatina' → 'creatina', but 'BCAA' and 'Vitamina D' keep their capitals where they matter
const lower = n => (n.length > 1 && n[1] === n[1].toLowerCase() ? n[0].toLowerCase() + n.slice(1) : n)

/** The reminders for the next WINDOW days, as LocalNotifications wants them. */
export function buildSupplementNotifications(S, now = new Date()) {
  const list = (Array.isArray(S?.supplements) ? S.supplements : []).filter(s => s && s.remind !== false)
  const out = []
  for (let d = 0; d < WINDOW; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 12)
    const iso = isoOf(day)
    let k = 0
    for (const s of list) {
      if (!dueOn(s, iso, S)) continue
      for (const t of (s.times || []).slice(0, s.perDay || 1)) {
        const m = minutes(t)
        if (m == null || k >= PER_DAY_IDS) continue
        const at = new Date(day); at.setHours(Math.floor(m / 60), m % 60, 0, 0)
        if (at <= now) { k++; continue }
        const name = lower(nameOf(s))
        const fem = CAT[s.kind]?.f ?? (s.kind === 'other' && /a$/i.test(name))
        out.push({
          id: ID_BASE + d * PER_DAY_IDS + k,
          title: 'Hora ' + (fem ? 'da ' : 'do ') + name + ' 💊',
          body: (s.amount ? 'Tome ' + s.amount + ' de ' + name + '.' : 'Não esquece ' + (fem ? 'a sua ' : 'o seu ') + name + '.') + ' O CARGA lembra, você toma.',
          schedule: { at, allowWhileIdle: true },
        })
        k++
      }
    }
  }
  return out
}

/** (Re)schedules the reminders. `interactive` may ask for the notification permission. */
export async function syncSupplements(S, interactive = false) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: Array.from({ length: WINDOW * PER_DAY_IDS }, (_, i) => ({ id: ID_BASE + i })) }).catch(() => {})
    const notifications = buildSupplementNotifications(S)
    if (!notifications.length) return true
    let perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted' && interactive) perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return false
    await LocalNotifications.schedule({ notifications })
    return true
  } catch { return false }
}
