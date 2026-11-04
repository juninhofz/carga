// CARGA: the challenge notices with the app closed (Web Push). The phone subscribes with the key the
// `push` edge function hands out and the subscription is kept in push_subscriptions under the
// signed-in person; the database calls that function for every new notice, and the service worker
// (public/sw.js) shows it. On the iPhone this works only once CARGA is on the home screen.
import { cloud, CLOUD_URL, currentUser } from './cloud.js'

const FN = CLOUD_URL + '/functions/v1/push'

const fromB64 = b64 => {
  const padded = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true } catch { return false } }
const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent || '')

/**
 * Where this phone stands: 'on' (subscribed and allowed), 'off' (can be turned on), 'blocked'
 * (the person said no in the browser), 'install' (an iPhone that has to add CARGA to the home
 * screen first) or 'unsupported'.
 */
export async function pushState() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return iPhone() && !standalone() ? 'install' : 'unsupported'
  if (!('PushManager' in window)) return iPhone() && !standalone() ? 'install' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}

async function save(sub) {
  const j = sub.toJSON()
  const { error } = await cloud().from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

/** Asks for permission, subscribes this phone and saves it for the signed-in person. */
export async function enableNotices() {
  if (!(await currentUser())) throw new Error('Entre na sua conta para receber os avisos.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Os avisos não foram permitidos. Dá para liberar nos ajustes do navegador.')
  const reg = await navigator.serviceWorker.ready
  const { key } = await (await fetch(FN)).json()
  let sub = await reg.pushManager.getSubscription()
  // a subscription made with another key (openGym's own) cannot carry CARGA's notices
  if (sub && toB64(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== key.replace(/=+$/, '')) { await sub.unsubscribe().catch(() => {}); sub = null }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64(key) })
  await save(sub)
}

/** Once per signed-in start: the subscription this phone holds is saved again (the person may have changed). */
export async function syncNotices() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return
    if (!(await currentUser())) return
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
    if (sub) await save(sub)
  } catch { /* offline: next start */ }
}
