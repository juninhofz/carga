// CARGA notifications: written by the database when something happens in your challenges (a post,
// a comment or reaction on yours, someone joining, a poke); here they are read, counted, marked
// read and followed live. While the app is open in the background a new one also shows as a phone
// notification (the service worker draws it); real push with the app closed comes with the
// installed app.
import { create } from 'zustand'
import { cloud, currentUser } from './cloud.js'

export const useNotes = create(() => ({ list: [], unread: 0, loaded: false }))

const db = () => cloud()

export async function loadNotes() {
  const uid = (await currentUser())?.id
  if (!uid) { useNotes.setState({ list: [], unread: 0, loaded: true }); return }
  const { data } = await db().from('notifications').select('*').order('created_at', { ascending: false }).limit(60)
  const list = data || []
  useNotes.setState({ list, unread: list.filter(n => !n.read_at).length, loaded: true })
}

export async function markAllRead() {
  const ids = useNotes.getState().list.filter(n => !n.read_at).map(n => n.id)
  if (!ids.length) return
  const at = new Date().toISOString()
  useNotes.setState(s => ({ list: s.list.map(n => (n.read_at ? n : { ...n, read_at: at })), unread: 0 }))
  await db().from('notifications').update({ read_at: at }).in('id', ids)
}

/** A poke to someone in a challenge; false when it was too soon (once every 12 hours). */
export async function poke(challengeId, userId) {
  const { data, error } = await db().rpc('poke', { p_challenge: challengeId, p_user: userId })
  if (error) throw new Error(error.message)
  return !!data
}

async function showOnPhone(n) {
  try {
    if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.ready
    reg?.showNotification(n.title, { body: n.body || '', tag: 'carga-note-' + n.id, icon: 'icon-512.png', badge: 'icon-180.png', data: { path: n.challenge_id ? '/desafios/' + n.challenge_id : '/desafios' } })
  } catch { /* fine */ }
}

let channel = null
/** Follows my notifications live; `onNew(n)` for each new one. Returns a stop function. */
export function watchNotes(uid, onNew) {
  if (!uid) return () => {}
  try {
    channel = db().channel('notes-' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, payload => {
        const n = payload.new
        useNotes.setState(s => ({ list: [n, ...s.list].slice(0, 60), unread: s.unread + 1 }))
        showOnPhone(n)
        onNew?.(n)
      })
      .subscribe()
  } catch { channel = null }
  return () => { try { if (channel) db().removeChannel(channel) } catch { /* fine */ } channel = null }
}
