// CARGA runs: the map under a run. OpenStreetMap tiles through Leaflet (the same as the gym map,
// loaded only when a map is on screen), the route as one orange line per stretch between pauses,
// a dot where the run started and one where it ended (or where the runner is now, live).
import { useEffect, useRef } from 'react'
import { TILES } from '../lib/gym-places.js'

export default function RunMap({ segments = [], here = null, live = false, className = '' }) {
  const host = useRef(null)
  const m = useRef(null)
  useEffect(() => {
    let gone = false
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      const L = mod.default || mod
      if (gone || !host.current) return
      const map = L.map(host.current, { zoomControl: false, attributionControl: true }).setView([-15.8, -47.9], 3)
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>')
      L.tileLayer(TILES.url, { maxZoom: TILES.maxZoom, attribution: TILES.attribution }).addTo(map)
      const lines = L.layerGroup().addTo(map)
      const dots = L.layerGroup().addTo(map)
      m.current = { L, map, lines, dots, fitted: false, touched: false }
      map.on('dragstart', () => { if (m.current) m.current.touched = true })
      setTimeout(() => { if (!gone) { map.invalidateSize({ pan: false }); draw() } }, 300)
      draw()
    }).catch(() => {})
    return () => { gone = true; m.current?.map.remove(); m.current = null }
  }, [])

  const draw = () => {
    const c = m.current
    if (!c) return
    const { L, map, lines, dots } = c
    const segs = latest.current.segments.filter(s => s.length)
    const pos = latest.current.here
    lines.clearLayers()
    dots.clearLayers()
    for (const s of segs) {
      L.polyline(s, { color: '#000', weight: 7, opacity: 0.25, interactive: false }).addTo(lines)
      L.polyline(s, { color: '#ff6b00', weight: 4.5, opacity: 1, lineJoin: 'round', interactive: false }).addTo(lines)
    }
    const first = segs[0]?.[0]
    const lastSeg = segs[segs.length - 1]
    const last = lastSeg?.[lastSeg.length - 1]
    if (first) L.circleMarker(first, { radius: 6, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1, interactive: false }).addTo(dots)
    if (latest.current.live) {
      const p = pos ? [pos.lat, pos.lng] : last
      if (p) {
        if (pos?.acc) L.circle(p, { radius: pos.acc, color: '#3b82f6', weight: 1, opacity: 0.4, fillOpacity: 0.12, interactive: false }).addTo(dots)
        L.circleMarker(p, { radius: 8, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1, interactive: false }).addTo(dots)
        if (!c.touched) map.setView(p, c.fitted ? map.getZoom() : 17, { animate: c.fitted })
        c.fitted = true
      }
    } else if (last) {
      L.circleMarker(last, { radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1, interactive: false }).addTo(dots)
      if (!c.fitted) { map.fitBounds(L.latLngBounds(segs.flat()), { padding: [24, 24], maxZoom: 17 }); c.fitted = true }
    }
  }
  const latest = useRef({ segments, here, live })
  latest.current = { segments, here, live }
  useEffect(draw, [segments, here?.lat, here?.lng, here?.acc, live])

  const recenter = () => { if (m.current) { m.current.touched = false; draw() } }
  return <div className={'run-map ' + className}>
    <div className="run-map-in" ref={host} role="application" aria-label="Mapa do percurso" />
    {live && <button type="button" className="run-recenter" onClick={recenter} aria-label="Centralizar">◎</button>}
  </div>
}
