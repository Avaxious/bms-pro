/* ============================================================
   BMS Dashboard — Filter Logic
   ============================================================ */

import { state, $, isJalali } from './state'
import { fmtDateJalali, fmtDateMiladi, g2j, j2g } from './calendar'
import { debounce, log } from './utils'
import { aggregateAsync, aggregateFromRecords } from './data'
import { renderAll } from './charts'
import type { AggResult, BmsRecord } from './types'

function todayStrFmt(): string {
  return isJalali() ? fmtDateJalali(new Date()) : fmtDateMiladi(new Date())
}

function fmtDate(d: Date): string {
  return isJalali() ? fmtDateJalali(d) : fmtDateMiladi(d)
}

export function fmtDateToMs(s: string): number {
  if (!s) return 0
  const p = s.split(/[-\/]/)
  if (p.length < 3) return 0
  if (isJalali()) {
    const g = j2g(parseInt(p[0]), parseInt(p[1]), parseInt(p[2]))
    if (!g[0]) return 0
    return new Date(g[0], g[1] - 1, g[2]).getTime()
  }
  return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2])).getTime()
}

function parseDateInput(str: string): Date | null {
  if (!str) return null
  if (isJalali()) {
    const p = str.split(/[-\/]/)
    if (p.length < 3) return null
    const jy = parseInt(p[0]), jm = parseInt(p[1]), jd = parseInt(p[2])
    const g = j2g(jy, jm, jd)
    if (g[0] === 0) return null
    return new Date(g[0], g[1] - 1, g[2])
  }
  return new Date(str + 'T00:00:00Z')
}

function updateDateInputs() {
  const fromEl = $('fltFrom') as HTMLInputElement | null
  const toEl = $('fltTo') as HTMLInputElement | null
  if (!fromEl || !toEl) return

  if (isJalali()) {
    fromEl.type = 'text'; fromEl.placeholder = 'مثال: 1404-04-29'
    toEl.type = 'text'; toEl.placeholder = 'مثال: 1404-05-01'
    if (fromEl.value) {
      const d = parseDateInput(fromEl.value) || new Date(fromEl.value + 'T00:00:00Z')
      if (d && !isNaN(d.getTime())) fromEl.value = fmtDateJalali(d)
    }
    if (toEl.value) {
      const d = parseDateInput(toEl.value) || new Date(toEl.value + 'T00:00:00Z')
      if (d && !isNaN(d.getTime())) toEl.value = fmtDateJalali(d)
    }
  } else {
    fromEl.type = 'date'; fromEl.placeholder = ''
    toEl.type = 'date'; toEl.placeholder = ''
    if (fromEl.value && fromEl.value.match(/^\d{4}-\d{2}-\d{2}$/)) { /* ok */ }
    else if (fromEl.value) {
      const d = parseDateInput(fromEl.value)
      if (d && !isNaN(d.getTime())) fromEl.value = fmtDateMiladi(d)
    }
    if (toEl.value && toEl.value.match(/^\d{4}-\d{2}-\d{2}$/)) { /* ok */ }
    else if (toEl.value) {
      const d = parseDateInput(toEl.value)
      if (d && !isNaN(d.getTime())) toEl.value = fmtDateMiladi(d)
    }
  }
}

export function getFilteredRecords(): BmsRecord[] {
  let r = state.rawRecords
  const f = state.activeFilters
  const from = (document.getElementById('fltFrom') as HTMLInputElement)?.value || ''
  const to = (document.getElementById('fltTo') as HTMLInputElement)?.value || ''
  const fromDate = from ? parseDateInput(from) : null
  const toDate = to ? parseDateInput(to) : null

  if (from || to || f.fwd.length || f.pol.length || f.line.length || f.agent.length) {
    r = r.filter((rec) => {
      if (from || to) {
        if (!rec.arrv_date) return false
        const rd = rec.arrv_date.getTime()
        if (fromDate && rd < fromDate.getTime()) return false
        if (toDate && rd > toDate.getTime() + 86400000) return false
      }
      if (f.fwd.length && (!rec.pol_forwarder || f.fwd.indexOf(rec.pol_forwarder) === -1)) return false
      if (f.pol.length && (!rec.pol || f.pol.indexOf(rec.pol) === -1)) return false
      if (f.line.length && (!rec.line || f.line.indexOf(rec.line) === -1)) return false
      if (f.agent.length && (!rec.iran_agent || f.agent.indexOf(rec.iran_agent) === -1)) return false
      return true
    })
  }
  return r
}

export function refreshDashboard() {
  if (!state.rawRecords.length) return
  const records = getFilteredRecords()
  const filterInfo = $('filterInfo')
  if (filterInfo) filterInfo.textContent = records.length.toLocaleString() + ' رکورد (' + (state.rawRecords.length ? Math.round(records.length / state.rawRecords.length * 100) + '% از کل' : '—') + ')'

  const from = (document.getElementById('fltFrom') as HTMLInputElement)?.value || ''
  const to = (document.getElementById('fltTo') as HTMLInputElement)?.value || ''
  const fromDate = from ? parseDateInput(from) : null
  const toDate = to ? parseDateInput(to) : null

  let prevRecords: BmsRecord[] | null = null
  let prevFromStr: string | null = null
  let prevToStr: string | null = null
  let curPeriodLabel: string | null = null
  let prevPeriodLabel: string | null = null

  if (fromDate && toDate && !isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
    const prevFrom = new Date(fromDate.getFullYear() - 1, fromDate.getMonth(), fromDate.getDate())
    const prevTo = new Date(toDate.getFullYear() - 1, toDate.getMonth(), toDate.getDate())
    prevFromStr = fmtDate(prevFrom); prevToStr = fmtDate(prevTo)
    prevRecords = state.rawRecords.filter((r) => {
      if (!r.arrv_date) return false
      const dm = fmtDateToMs(fmtDate(r.arrv_date))
      if (dm < fmtDateToMs(prevFromStr!)) return false
      if (dm > fmtDateToMs(prevToStr!)) return false
      if (state.activeFilters.fwd.length && state.activeFilters.fwd.indexOf(r.pol_forwarder!) === -1) return false
      if (state.activeFilters.pol.length && state.activeFilters.pol.indexOf(r.pol!) === -1) return false
      if (state.activeFilters.line.length && state.activeFilters.line.indexOf(r.line!) === -1) return false
      if (state.activeFilters.agent.length && state.activeFilters.agent.indexOf(r.iran_agent!) === -1) return false
      return true
    })
    curPeriodLabel = from + ' تا ' + to
    prevPeriodLabel = prevFromStr + ' تا ' + prevToStr
  } else if (records.length > 1) {
    const recDates = records.map((r) => r.arrv_date).filter(Boolean) as Date[]
    if (recDates.length > 1) {
      const minRD = new Date(Math.min(...recDates.map((d) => d.getTime())))
      const maxRD = new Date(Math.max(...recDates.map((d) => d.getTime())))
      if (Math.round((maxRD.getTime() - minRD.getTime()) / 86400000) > 0) {
        const rpFrom = new Date(minRD.getFullYear() - 1, minRD.getMonth(), minRD.getDate())
        const rpTo = new Date(maxRD.getFullYear() - 1, maxRD.getMonth(), maxRD.getDate())
        prevFromStr = fmtDate(rpFrom); prevToStr = fmtDate(rpTo)
        prevRecords = state.rawRecords.filter((r) => {
          if (!r.arrv_date) return false
          const dm = fmtDateToMs(fmtDate(r.arrv_date))
          if (dm < fmtDateToMs(prevFromStr!)) return false
          if (dm > fmtDateToMs(prevToStr!)) return false
          return true
        })
        curPeriodLabel = fmtDate(minRD) + ' تا ' + fmtDate(maxRD)
        prevPeriodLabel = prevFromStr + ' تا ' + prevToStr
      }
    }
  }

  const filterParams = { dateFormat: localStorage.getItem('bms_dateformat') || 'miladi' }

  function onMainResult(mainData: AggResult | null) {
    if (!mainData) mainData = aggregateFromRecords(records)
    const existingContainers = new Set(mainData.all_records.map((r) => r.container))
    const pending = state.rawRecords.filter((r) => !r.arrv_date && (!existingContainers.has(r.container) || !r.container))
    pending.forEach((r) => {
      mainData!.all_records.push({
        container: r.container || null, vessel: r.vessel || null, size: r.size || null,
        qty: r.qty || 0, pol_forwarder: r.pol_forwarder || null, pol: r.pol || null,
        line: r.line || null, iran_agent: r.iran_agent || null, date: '', status: r.status || 'Pending',
      })
    })

    if (prevRecords) {
      function onPrevResult(prevData: AggResult | null) {
        if (!prevData) prevData = aggregateFromRecords(prevRecords!)
        mainData!.prevPeriod = prevData
        mainData!.prevPeriodLabel = prevPeriodLabel!
        mainData!.curPeriodLabel = curPeriodLabel!
        renderAll(mainData!, state.currentMeta)
      }
      aggregateAsync(prevRecords, filterParams, onPrevResult, state)
    } else {
      renderAll(mainData!, state.currentMeta)
    }
  }

  aggregateAsync(records, filterParams, onMainResult, state)
}

export const debouncedRefresh = debounce(() => { refreshDashboard() }, 200)

export function buildMsOptions() {
  state.filterIds.forEach((id, i) => {
    const sel = $(id) as HTMLSelectElement | null
    if (!sel) return
    const prop = state.filterProps[i] as keyof BmsRecord
    const cur = sel.value
    const s = new Set<string>()
    state.rawRecords.forEach((r) => { const v = r[prop]; if (v) s.add(v as string) })
    const vals = Array.from(s).sort()
    sel.replaceChildren(new Option('همه', ''))
    vals.forEach((v) => { sel.appendChild(new Option(v, v)) })
    sel.value = cur
  })
}

export function filterBySelect() {
  state.activeFilters.fwd = [(document.getElementById('cb-fwd') as HTMLSelectElement)?.value || ''].filter(Boolean)
  state.activeFilters.pol = [(document.getElementById('cb-pol') as HTMLSelectElement)?.value || ''].filter(Boolean)
  state.activeFilters.line = [(document.getElementById('cb-line') as HTMLSelectElement)?.value || ''].filter(Boolean)
  state.activeFilters.agent = [(document.getElementById('cb-agent') as HTMLSelectElement)?.value || ''].filter(Boolean)
  debouncedRefresh()
}

export function initFilters() {
  const today = todayStrFmt()
  if (!state.rawRecords.length) {
    const n = new Date()
    const fromEl = $('fltFrom') as HTMLInputElement | null
    if (isJalali()) {
      const j = g2j(n.getFullYear(), n.getMonth() + 1, n.getDate())
      if (fromEl) fromEl.value = j[0] + '-' + String(j[1]).padStart(2, '0') + '-01'
    } else {
      if (fromEl) fromEl.value = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-01'
    }
    const toEl = $('fltTo') as HTMLInputElement | null
    if (toEl) toEl.value = today
    updateDateInputs()
    return
  }

  const dates = state.rawRecords.map((r) => r.arrv_date).filter(Boolean) as Date[]
  const fromEl = $('fltFrom') as HTMLInputElement | null
  const toEl = $('fltTo') as HTMLInputElement | null

  if (dates.length) {
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))
    if (fromEl) fromEl.value = fmtDate(minDate)
    if (toEl) toEl.value = fmtDate(maxDate)
  } else {
    const now = new Date()
    if (isJalali()) {
      const j = g2j(now.getFullYear(), now.getMonth() + 1, now.getDate())
      if (fromEl) fromEl.value = j[0] + '-' + String(j[1]).padStart(2, '0') + '-01'
    } else {
      if (fromEl) fromEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01'
    }
    if (toEl) toEl.value = today
  }

  buildMsOptions()
  updateFilterOptions()

  const c1s = $('c1s') as HTMLInputElement | null
  const c1e = $('c1e') as HTMLInputElement | null
  const c2s = $('c2s') as HTMLInputElement | null
  const c2e = $('c2e') as HTMLInputElement | null
  if (c1s) c1s.value = fmtDate(new Date())
  if (c1e) c1e.value = today
  if (c2s) c2s.value = today
  if (c2e) c2e.value = today

  updateDateInputs()
}

export function resetFilters() {
  state.activeFilters = { fwd: [], pol: [], line: [], agent: [] }
  state.filterIds.forEach((id) => { const sel = $(id) as HTMLSelectElement | null; if (sel) sel.value = '' })
  const now = new Date()
  const fromEl = $('fltFrom') as HTMLInputElement | null
  if (isJalali()) {
    const j = g2j(now.getFullYear(), now.getMonth() + 1, now.getDate())
    if (fromEl) fromEl.value = j[0] + '-' + String(j[1]).padStart(2, '0') + '-01'
  } else {
    if (fromEl) fromEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01'
  }
  const toEl = $('fltTo') as HTMLInputElement | null
  if (toEl) toEl.value = todayStrFmt()
  updateFilterOptions()
  updateDateInputs()
  highlightPreset(null)
  debouncedRefresh()
}

export function onDateChange() {
  updateFilterOptions()
  debouncedRefresh()
  highlightPreset(null)
}

export function highlightPreset(id: string | null) {
  document.querySelectorAll('.date-preset').forEach((b) => b.classList.remove('active'))
  if (id) {
    const el = $('dp-' + id)
    if (el) el.classList.add('active')
  }
}

export function setDatePreset(preset: string) {
  const now = new Date()
  let from: string
  const to = fmtDate(now)

  if (isJalali()) {
    const jToday = g2j(now.getFullYear(), now.getMonth() + 1, now.getDate())
    const jy = jToday[0], jm = jToday[1]
    if (preset === 'today') { from = to }
    else if (preset === '7days') { const d = new Date(now); d.setDate(d.getDate() - 7); from = fmtDate(d) }
    else if (preset === '30days') { const d = new Date(now); d.setDate(d.getDate() - 30); from = fmtDate(d) }
    else if (preset === 'month') { from = jy + '-' + String(jm).padStart(2, '0') + '-01' }
    else if (preset === 'quarter') { const qm = Math.floor((jm - 1) / 3) * 3 + 1; from = jy + '-' + String(qm).padStart(2, '0') + '-01' }
    else if (preset === 'year') { from = jy + '-01-01' }
    else { from = to }
  } else {
    if (preset === 'today') { from = to }
    else if (preset === '7days') { const d = new Date(now); d.setDate(d.getDate() - 7); from = fmtDate(d) }
    else if (preset === '30days') { const d = new Date(now); d.setDate(d.getDate() - 30); from = fmtDate(d) }
    else if (preset === 'month') { from = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01' }
    else if (preset === 'quarter') { const q = Math.floor(now.getMonth() / 3); from = now.getFullYear() + '-' + String(q * 3 + 1).padStart(2, '0') + '-01' }
    else if (preset === 'year') { from = now.getFullYear() + '-01-01' }
    else { from = to }
  }

  const fromEl = $('fltFrom') as HTMLInputElement | null
  const toEl = $('fltTo') as HTMLInputElement | null
  if (fromEl) fromEl.value = from
  if (toEl) toEl.value = to
  updateFilterOptions()
  updateDateInputs()
  highlightPreset(preset)
  debouncedRefresh()
}

export function updateFilterOptions() {
  const from = (document.getElementById('fltFrom') as HTMLInputElement)?.value || ''
  const to = (document.getElementById('fltTo') as HTMLInputElement)?.value || ''
  let dateFiltered = state.rawRecords

  if (from || to) {
    dateFiltered = state.rawRecords.filter((r) => {
      if (!r.arrv_date) return false
      const d = fmtDate(r.arrv_date), dm = fmtDateToMs(d)
      if (from && dm < fmtDateToMs(from)) return false
      if (to && dm > fmtDateToMs(to)) return false
      return true
    })
  }

  state.filterIds.forEach((id, i) => {
    const sel = $(id) as HTMLSelectElement | null
    if (!sel) return
    const prop = state.filterProps[i] as keyof BmsRecord
    const cur = sel.value
    const s = new Set<string>()
    dateFiltered.forEach((r) => { const v = r[prop]; if (v) s.add(v as string) })
    const vals = Array.from(s).sort()
    sel.replaceChildren(new Option('همه', ''))
    vals.forEach((v) => { sel.appendChild(new Option(v, v)) })
    if (cur && vals.indexOf(cur) !== -1) sel.value = cur
  })

  const advKeys: (keyof BmsRecord)[] = ['pol_forwarder', 'pol', 'line', 'iran_agent', 'size']
  const advIds = ['advFwd', 'advPol', 'advLine', 'advAgent', 'advSize']
  advKeys.forEach((key, i) => {
    const s = new Set<string>()
    dateFiltered.forEach((r) => { const v = r[key]; if (v) s.add(v as string) })
    const vals = Array.from(s).sort()
    const sel = $(advIds[i]) as HTMLSelectElement | null
    if (!sel) return
    const cur = sel.value
    sel.replaceChildren(new Option('همه', ''))
    vals.forEach((v) => { sel.appendChild(new Option(v, v)) })
    if (cur && vals.indexOf(cur) !== -1) sel.value = cur
  })
}

export function toggleDateFormat() {
  state.dateFormat = isJalali() ? 'miladi' : 'jalali'
  localStorage.setItem('bms_dateformat', state.dateFormat)
  const dateModeBtn = $('dateModeBtn')
  if (dateModeBtn) dateModeBtn.textContent = isJalali() ? '📅 شمسی' : '📅 میلادی'
  if (state.rawRecords.length) { updateDateInputs(); initFilters() }
  refreshDashboard()
}
