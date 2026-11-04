// CARGA's account and cloud (Supabase): sign up with an e-mail and a password, the name on the
// rank card, the training data saved and merged across devices, and the rank cards' own numbers.
//
// The app keeps working without an account, exactly as before: the cloud only joins in once
// someone signs in. Everything is kept per account by the database's row security (the tables
// and the two functions are in the Supabase project; see CARGA-ROADMAP.md).
//
// SYNC. The whole app state is one document per account, with a revision. Saving sends this
// device's copy over the revision it descends from (save_state); when another device saved first
// the answer is -1, and this device reads the saved copy, merges it into its own with the same
// merge the app uses for a backup ("merge them in", store importBackup → lib/sync-merge.js), and
// saves again. Nothing is ever replaced blind, so a workout logged on the phone and one on the
// computer both survive.
//
// RANK NUMBERS. The first account to reach a rank gets its Nº 1, the next its Nº 2. Once the
// best rank ever reached (lib/carga-level.js) is known, claim_ranks takes a number for every rank
// up to it that this account has not got yet; a number is kept for good.
import { createClient } from '@supabase/supabase-js'

const ENV = import.meta.env || {}
export const CLOUD_URL = ENV.VITE_CLOUD_URL ?? 'https://ffvtnragcqwvsvskxchq.supabase.co'
// a publishable key: safe in the app, it can only do what the row security allows
export const CLOUD_KEY = ENV.VITE_CLOUD_KEY ?? 'sb_publishable_9YGxPSZGPr52zUS4uBFhTA_C3o8bx8y'
export const CLOUD_ON = !!(CLOUD_URL && CLOUD_KEY)
// The rank cards' own numbers (who reached each rank first) are switched off for now: decided to
// come back to them later. The table and claim_ranks stay in the database, ready.
export const RANK_NUMBERS_ON = false

let client = null
export const cloud = () => {
  if (!CLOUD_ON) return null
  if (!client) client = createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'carga.auth' } })
  return client
}

/* ---------- account ---------- */

const ERRORS = {
  'Invalid login credentials': 'Wrong e-mail or password.',
  'User already registered': 'This e-mail already has an account. Sign in instead.',
  'Email not confirmed': 'Confirm your e-mail first: open the link we sent you.',
}
const cleanError = e => ERRORS[e?.message] || e?.message || 'Something went wrong. Try again.'

export async function signUp(email, password, name) {
  const { data, error } = await cloud().auth.signUp({ email, password, options: { data: { name } } })
  if (error) return { error: cleanError(error) }
  if (!data.session) return { confirm: true }
  await saveProfile({ name })
  return { user: data.user }
}
export async function signIn(email, password) {
  const { data, error } = await cloud().auth.signInWithPassword({ email, password })
  if (error) return { error: cleanError(error) }
  return { user: data.user }
}
export async function signOut() {
  await cloud().auth.signOut()
  forget()
}
export async function currentUser() {
  if (!CLOUD_ON) return null
  const { data } = await cloud().auth.getSession()
  return data.session?.user || null
}
export const onAuth = fn => {
  if (!CLOUD_ON) return () => {}
  const { data } = cloud().auth.onAuthStateChange((_e, session) => fn(session?.user || null))
  return () => data.subscription.unsubscribe()
}

/* ---------- profile ---------- */

export async function loadProfile() {
  const user = await currentUser()
  if (!user) return null
  const { data } = await cloud().from('profiles').select('name, rank, best, level, carga').eq('id', user.id).maybeSingle()
  return data || { name: user.user_metadata?.name || '', rank: 0, best: 0, level: 1, carga: 0 }
}
export async function saveProfile(fields) {
  const user = await currentUser()
  if (!user) return null
  const row = { id: user.id, updated_at: new Date().toISOString(), ...fields }
  if (row.name == null) row.name = user.user_metadata?.name || ''
  row.name = String(row.name).trim().slice(0, 40)
  const { error } = await cloud().from('profiles').upsert(row)
  return error ? null : row
}

/* ---------- rank numbers ---------- */

const NUMBERS = 'carga.numbers'
export const savedNumbers = () => { try { return JSON.parse(localStorage.getItem(NUMBERS) || '{}') } catch { return {} } }
/** Takes a number for every rank up to `best` not yet held; returns { [rank]: number }. */
export async function claimRanks(best) {
  const user = await currentUser()
  if (!user) return savedNumbers()
  const { data, error } = await cloud().rpc('claim_ranks', { best })
  if (error || !Array.isArray(data)) return savedNumbers()
  const map = Object.fromEntries(data.map(r => [r.rank, r.number]))
  try { localStorage.setItem(NUMBERS, JSON.stringify(map)) } catch { /* private mode */ }
  return map
}

/* ---------- the state ---------- */

const REV = 'carga.rev'
const readRev = () => { try { return Number(localStorage.getItem(REV)) || 0 } catch { return 0 } }
const writeRev = r => { try { localStorage.setItem(REV, String(r)) } catch { /* private mode */ } }
function forget() { try { localStorage.removeItem(REV); localStorage.removeItem(NUMBERS) } catch { /* private mode */ } }

/** The saved copy: { state, rev } or null when this account has none yet. */
export async function pullState() {
  const user = await currentUser()
  if (!user) return null
  const { data, error } = await cloud().from('user_state').select('state, rev').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return data || null
}

/**
 * Brings this device and the cloud level: merges the saved copy in (`merge(state)` joins it into
 * the app's own) and saves the result. Tries again if another device saves in between.
 */
export async function syncState({ get, merge }) {
  const user = await currentUser()
  if (!user) return { ok: false }
  for (let attempt = 0; attempt < 4; attempt++) {
    let base = readRev()
    const saved = await pullState()
    if (saved && saved.rev !== base) { merge(saved.state); base = saved.rev }
    if (!saved) base = 0
    const { data, error } = await cloud().rpc('save_state', { new_state: get(), base_rev: base })
    if (error) throw error
    if (data > 0) { writeRev(data); return { ok: true, rev: data } }
  }
  return { ok: false }
}
