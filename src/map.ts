/* ============================================================
   BMS Dashboard — Map Rendering (Leaflet)
   ============================================================ */

import { state, $ } from './state'
import { fmtInt, esc } from './utils'
import { debouncedRefresh } from './filter'
import type { AggResult } from './types'

declare const L: any

function getLeaflet(): any {
  return (window as any).L
}

function greatCircle(lat1: number, lng1: number, lat2: number, lng2: number, n: number): [number, number][] {
  const toRad = Math.PI / 180
  const lat1r = lat1 * toRad, lng1r = lng1 * toRad
  const lat2r = lat2 * toRad, lng2r = lng2 * toRad
  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat1r - lat2r) / 2), 2) +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.pow(Math.sin((lng1r - lng2r) / 2), 2)
  ))
  if (d < .01) return [[lat1, lng1], [lat2, lng2]]
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1r) * Math.cos(lng1r) + B * Math.cos(lat2r) * Math.cos(lng2r)
    const y = A * Math.cos(lat1r) * Math.sin(lng1r) + B * Math.cos(lat2r) * Math.sin(lng2r)
    const z = A * Math.sin(lat1r) + B * Math.sin(lat2r)
    pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / toRad, Math.atan2(y, x) / toRad])
  }
  return pts
}

function filterByPol(polName: string) {
  state.activeFilters.pol = [polName]
  const sel = document.getElementById('cb-pol') as HTMLSelectElement | null
  if (sel) sel.value = polName
  debouncedRefresh()
  showPolResetBtn(polName)
  setTimeout(() => {
    const el = document.querySelector('.board') || document.getElementById('contListInfo')
    if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 100)
}

function showPolResetBtn(polName: string) {
  if (state.polResetEl) { state.polResetEl.remove(); state.polResetEl = null }
  const mapC = $('mapC')
  if (!mapC) return
  state.polResetEl = document.createElement('div')
  state.polResetEl.style.cssText = 'position:absolute;top:10px;right:10px;z-index:1000;background:var(--panel);border:1px solid var(--teal);color:var(--text);padding:6px 14px;border-radius:100px;cursor:pointer;font-size:11px;font-family:var(--sans);box-shadow:0 4px 16px rgba(0,0,0,.5);white-space:nowrap;'
  state.polResetEl.innerHTML = '✕ ' + esc(polName) + ' <span style="opacity:.65;">↺ بازنشانی</span>'
  state.polResetEl.onclick = () => {
    state.activeFilters.pol = []
    const sel = document.getElementById('cb-pol') as HTMLSelectElement | null
    if (sel) sel.value = ''
    debouncedRefresh()
    if (state.polResetEl) { state.polResetEl.remove(); state.polResetEl = null }
  }
  mapC.appendChild(state.polResetEl)
}

export function renderMap(v: AggResult) {
  const c = $('mapC')
  if (!c) return
  const Leaflet = getLeaflet()
  if (!Leaflet || !v.pol_coords || !v.pol_coords.length) {
    if (state.mapInstance) { state.mapInstance.remove(); state.mapInstance = null; state.animId = null }
    if (state.polResetEl) { state.polResetEl.remove(); state.polResetEl = null }
    return
  }

  const curPols = v.pol_coords.map((p) => p.name + ':' + p.count).join('|')
  if (state.prevPols === curPols && state.mapInstance) return
  if (state.mapInstance) { state.mapInstance.remove(); state.mapInstance = null; state.animId = null }
  if (state.polResetEl) { state.polResetEl.remove(); state.polResetEl = null }

  state.prevPols = curPols
  state.mapInstance = Leaflet.map('mapC', { zoomControl: false, attributionControl: false }).setView([27.5, 64], 4)
  Leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(state.mapInstance)
  state.mapInstance.getContainer().querySelector('.leaflet-tile-pane').style.filter = 'brightness(.75) contrast(1.2) saturate(.6)'

  const icanIcon = Leaflet.divIcon({
    html: '<div class="map-marker"><svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#FF4757" opacity=".2"/><circle cx="18" cy="18" r="11" fill="#FF4757" opacity=".55"/><circle cx="18" cy="18" r="6" fill="#FF4757"/></svg></div>',
    iconSize: [36, 36], iconAnchor: [18, 18], className: '',
  })
  Leaflet.marker([27.18, 56.27], { icon: icanIcon }).addTo(state.mapInstance).bindTooltip('Bandar Abbas<small>مقصد (ایران)</small>', { direction: 'top', className: 'map-label dest' })

  // Compute status per POL
  const polStatus: Record<string, { arr: number; pen: number }> = {}
  ;(v.all_records || []).forEach((r) => {
    const pol = r.pol; if (!pol) return
    if (!polStatus[pol]) polStatus[pol] = { arr: 0, pen: 0 }
    if (r.status === 'Arrived') polStatus[pol].arr++
    else polStatus[pol].pen++
  })

  const maxCount = Math.max(...v.pol_coords.map((p) => p.count))
  const animPaths: { pts: [number, number][]; color: string }[] = []

  v.pol_coords.forEach((p) => {
    const s = polStatus[p.name]
    let lineColor: string
    if (!s || (s.arr > 0 && s.pen === 0)) lineColor = '#22C0AE'
    else if (s.pen > 0 && s.arr === 0) lineColor = '#E5654A'
    else lineColor = '#E8AE52'

    const pts = greatCircle(p.lat, p.lng, 27.18, 56.27, 48)
    Leaflet.polyline(pts, { color: '#fff', weight: 4, opacity: .5 }).addTo(state.mapInstance)
    const line = Leaflet.polyline(pts, { color: lineColor, weight: 2.5, opacity: .85 }).addTo(state.mapInstance)
    line.on('click', () => filterByPol(p.name))
    animPaths.push({ pts, color: lineColor })

    const r = Math.max(8, Math.sqrt(p.count / maxCount) * 28)
    const portIcon = Leaflet.divIcon({
      html: '<div class="map-marker"><svg width="' + (r * 2 + 4) + '" height="' + (r * 2 + 4) + '" viewBox="0 0 ' + (r * 2 + 4) + ' ' + (r * 2 + 4) + '"><circle cx="' + (r + 2) + '" cy="' + (r + 2) + '" r="' + r + '" fill="' + lineColor + '" opacity=".7"/><circle cx="' + (r + 2) + '" cy="' + (r + 2) + '" r="' + (r * 0.45) + '" fill="' + lineColor + '"/></svg></div>',
      iconSize: [r * 2 + 4, r * 2 + 4], iconAnchor: [r + 2, r + 2], className: '',
    })
    Leaflet.marker([p.lat, p.lng], { icon: portIcon }).addTo(state.mapInstance).bindTooltip(esc(p.name) + '<small>' + fmtInt(p.count) + ' کانتینر</small>', { direction: 'top', className: 'map-label port' })
  })

  // Animated dots
  if (animPaths.length) {
    const dotGroup = Leaflet.layerGroup().addTo(state.mapInstance)
    const dots = animPaths.map((path, i) => {
      const dot = Leaflet.circleMarker(path.pts[0], { radius: 3.5, color: '#fff', weight: 2, fillColor: path.color, fillOpacity: .9 })
      dotGroup.addLayer(dot)
      return { dot, path: path.pts, idx: i * 12, speed: .008 + Math.random() * .01 }
    })

    function animLoop() {
      if (!state.mapInstance || !state.mapInstance._map) { state.animId = null; return }
      if (!document.hidden) {
        dots.forEach((d) => {
          d.idx += d.speed
          if (d.idx >= d.path.length) d.idx = 0
          d.dot.setLatLng(d.path[Math.floor(d.idx)])
        })
      }
      state.animId = requestAnimationFrame(animLoop)
    }
    state.animId = requestAnimationFrame(animLoop)
  }

  setTimeout(() => { if (state.mapInstance) state.mapInstance.invalidateSize() }, 150)
}
