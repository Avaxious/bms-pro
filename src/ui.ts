/* ============================================================
   BMS Dashboard — UI Components
   ============================================================ */

import { state, $, safeGet } from './state'
import { esc, fmtInt, debounce } from './utils'
import type { ContainerRecord } from './types'

export function showToast(msg: string, isErr?: boolean) {
  const t = $('toast')
  if (!t) return
  t.textContent = msg
  t.className = 'show' + (isErr ? ' err' : '')
  clearTimeout((showToast as any)._t)
  ;(showToast as any)._t = setTimeout(() => { t.className = '' }, 3500)
}

export function showBanner(msg: string) {
  const b = $('libBanner')
  if (!b) return
  if (msg) b.querySelector('div')!.innerHTML = msg
  b.classList.add('show')
}

export function toggleAdvSearch() {
  const w = $('advWrap')
  if (w) w.classList.toggle('show')
}

export function advSearchChange() {
  debouncedContSearch()
}

export const debouncedContSearch = debounce(() => { renderContainerList() }, 150)

// ---- Container List (Virtual Scroll) ----

const ROW_H = 28

function cel(v: unknown): string {
  return (v == null || v === '') ? '<td class="miss">—</td>' : '<td>' + esc(v) + '</td>'
}

function celSz(v: unknown): string {
  if (v == null || v === '') return '<td class="miss">—</td>'
  return '<td class="sz">' + esc(v) + "'" + '</td>'
}

let vsRafPending = false
function vsRenderRows() {
  if (vsRafPending) return
  vsRafPending = true
  requestAnimationFrame(() => {
    vsRafPending = false
    if (!state.vsScrollEl || !state.vsBodyEl) return
  const scrollTop = state.vsScrollEl.scrollTop
  const viewH = state.vsScrollEl.clientHeight
  const total = state.vsFiltered.length
  const headH = 36
  const startIdx = Math.max(0, Math.floor((scrollTop - headH) / ROW_H) - 3)
    const endIdx = Math.min(total, Math.ceil((scrollTop - headH + viewH) / ROW_H) + 3)

  if (total === 0) {
    state.vsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="11" style="text-align:center;padding:40px 16px;color:var(--text-faint);font-size:13px;">🔍 نتیجه‌ای یافت نشد — فیلترها یا جستجو را تغییر دهید</td></tr>'
    return
  }

  const topPad = startIdx * ROW_H
  const bottomPad = Math.max(0, (total - endIdx) * ROW_H)

  let html = ''
  if (topPad > 0) html += '<tr style="height:' + topPad + 'px"><td colspan="11"></td></tr>'
  for (let i = startIdx; i < endIdx; i++) {
    const r = state.vsFiltered[i]
    const cls = r.status === 'Arrived' ? 'stat-arr' : 'stat-pen'
    html += '<tr><td>' + (i + 1) + '</td>' + cel(r.container) + cel(r.vessel) + celSz(r.size) + '<td>' + parseInt(String(r.qty || 0)) + '</td>' + cel(r.pol_forwarder) + cel(r.pol) + cel(r.line) + cel(r.iran_agent) + cel(r.date) + '<td class="' + cls + '">' + (r.status === 'Arrived' ? 'Arrived' : 'Pending') + '</td></tr>'
  }
  if (bottomPad > 0) html += '<tr style="height:' + bottomPad + 'px"><td colspan="11"></td></tr>'
  state.vsBodyEl.innerHTML = html
  })
}

export function renderContainerList(records?: ContainerRecord[]) {
  if (records) state.allRecordsCache = records
  const all = state.allRecordsCache || []

  const q = (document.getElementById('contSearch') as HTMLInputElement)?.value.trim().toLowerCase() || ''
  const advVessel = (document.getElementById('advVessel') as HTMLInputElement)?.value.trim().toLowerCase() || ''
  const advFwd = (document.getElementById('advFwd') as HTMLSelectElement)?.value || ''
  const advPol = (document.getElementById('advPol') as HTMLSelectElement)?.value || ''
  const advLine = (document.getElementById('advLine') as HTMLSelectElement)?.value || ''
  const advAgent = (document.getElementById('advAgent') as HTMLSelectElement)?.value || ''
  const advSize = (document.getElementById('advSize') as HTMLSelectElement)?.value || ''
  const advStatus = (document.getElementById('advStatus') as HTMLSelectElement)?.value || ''
  const hasAdv = advVessel || advFwd || advPol || advLine || advAgent || advSize || advStatus

  state.vsFiltered = all.filter((r) => {
    if (q) {
      if (!r._search) r._search = [r.container, r.vessel, r.line, r.pol_forwarder, r.pol, r.iran_agent, r.size, r.qty, r.date, r.status].join(' ').toLowerCase()
      if (r._search.indexOf(q) === -1) return false
    }
    if (hasAdv) {
      if (advVessel && (r.vessel || '').toLowerCase().indexOf(advVessel) === -1) return false
      if (advFwd && (r.pol_forwarder || '') !== advFwd) return false
      if (advPol && (r.pol || '') !== advPol) return false
      if (advLine && (r.line || '') !== advLine) return false
      if (advAgent && (r.iran_agent || '') !== advAgent) return false
      if (advSize && (r.size || '') !== advSize) return false
      if (advStatus && (r.status || '') !== advStatus) return false
    }
    return true
  })

  const totalCount = $('contTotalCount')
  const showCount = $('contShowCount')
  if (totalCount) totalCount.textContent = fmtInt(state.vsFiltered.length)
  if (showCount) showCount.textContent = fmtInt(state.vsFiltered.length)

  if (!state.vsScrollEl) {
    state.vsScrollEl = $('contScroll')
    state.vsBodyEl = $('contBody')
    if (state.vsScrollEl) state.vsScrollEl.addEventListener('scroll', vsRenderRows)
  }
  if (state.vsScrollEl) state.vsScrollEl.scrollTop = 0
  vsRenderRows()
  const contListInfo = $('contListInfo')
  if (contListInfo) contListInfo.innerHTML = ''
}

export function updateFreshness() {
  const fetchTime = safeGet('bms_fetchtime')
  const el = $('autoRefLabel')
  if (!el || !fetchTime) return
  const ageSec = Math.floor((Date.now() - parseInt(fetchTime)) / 1000)
  const ageMin = Math.floor(ageSec / 60)
  const ageHour = Math.floor(ageMin / 60)
  let text: string, color: string
  if (ageSec < 10) { text = '🔄 هم‌اکنون'; color = '#4fd1a5' }
  else if (ageMin < 1) { text = '🔄 ' + ageSec + ' ثانیه پیش'; color = '#4fd1a5' }
  else if (ageMin < 60) { text = '🔄 ' + ageMin + ' دقیقه پیش'; color = ageMin < 30 ? '#4fd1a5' : '#E8B641' }
  else { text = '🔄 ' + ageHour + ' ساعت پیش'; color = '#E8566A' }
  el.textContent = text
  ;(el as HTMLElement).style.color = color
}
