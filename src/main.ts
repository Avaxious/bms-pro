/* ============================================================
   BMS Dashboard — Entry Point
   ============================================================ */

import './style.css'
import { state, $, isJalali } from './state'
import { log } from './utils'
import { setupChartDefaults, renderAll, toggleTheme, initTheme, updateDateFormatBtn, COLORS } from './charts'
import { doLogin, logout, checkSession, loadConfig, LOGIN_PROXY_URL } from './auth'
import { initFilters, resetFilters, setDatePreset, onDateChange, toggleDateFormat, filterBySelect, fmtDateToMs, getFilteredRecords } from './filter'
import { showToast, toggleAdvSearch, advSearchChange, debouncedContSearch, renderContainerList } from './ui'
import { exportCSV } from './export'
import { tryAutoFetch, loadFile } from './loader'
import { aggregateFromRecords } from './data'
import { showBanner } from './ui'
import { fmtInt } from './utils'

// ---- Period Comparison ----
function comparePeriods() {
  if (!state.rawRecords.length) return
  const p1s = (document.getElementById('c1s') as HTMLInputElement)?.value || ''
  const p1e = (document.getElementById('c1e') as HTMLInputElement)?.value || ''
  const p2s = (document.getElementById('c2s') as HTMLInputElement)?.value || ''
  const p2e = (document.getElementById('c2e') as HTMLInputElement)?.value || ''

  function calc(ss: string, se: string) {
    const arr = state.rawRecords.filter((r) => {
      if (!r.arrv_date) return false
      const ds = fmtDateToMs(String(r.arrv_date.getTime()))
      if (ss && ds < fmtDateToMs(ss)) return false
      if (se && ds > fmtDateToMs(se) + 86400000) return false
      return true
    })
    const contSet = new Set(arr.filter((r) => r.container).map((r) => r.container))
    let shipSum = 0
    arr.forEach((r) => { shipSum += r.qty })
    return {
      cont: contSet.size,
      ship: shipSum,
      lines: new Set(arr.map((r) => r.line).filter(Boolean)).size,
    }
  }

  const p1 = calc(p1s, p1e)
  const p2 = calc(p2s, p2e)
  const items = [
    { lbl: 'Container (ستون F)', k: 'cont' as const },
    { lbl: 'Shipment (ستون E)', k: 'ship' as const },
    { lbl: 'Lines فعال', k: 'lines' as const },
  ]
  const cmpGrid = $('cmpGrid')
  if (cmpGrid) {
    cmpGrid.innerHTML = items.map((item) => {
      const v1 = (p1 as any)[item.k], v2 = (p2 as any)[item.k]
      const diff = v2 - v1
      const pct = v1 ? ((v2 - v1) / v1 * 100).toFixed(1) : 'N/A'
      const cl = diff > 0 ? 'up' : diff < 0 ? 'dn' : ''
      return '<div class="cmp-item"><div class="cmp-lbl">' + item.lbl + '</div><div class="cmp-v ' + (diff > 0 ? 'teal' : 'gold') + '">' + fmtInt(v2) + '</div><div class="cmp-d">دوره ۱: ' + fmtInt(v1) + '</div><div class="cmp-ch ' + cl + '">' + (diff > 0 ? '+' : '') + pct + '%</div></div>'
    }).join('')
  }
}

// ---- Default Snapshot Data (shown before real data loads) ----
const DEFAULT_DATA = {"total_containers":7786,"total_shipments":8066,"total_teu":13710,"unique_vessels":2598,"unique_lines":155,"unique_forwarders":66,"unique_agents":73,"date_min":"2012-11-25","date_max":"2026-07-12","pending_count":16,"arrived_count":7769,"size_dist":[{"label":"40","value":5924},{"label":"20","value":1862}],"top_lines":[{"label":"FREIGHT CAPITAL SERVICES","value":2212},{"label":"OOCL","value":760},{"label":"EASY LINE","value":524},{"label":"SEAIR GLOBAL LOGISTICS","value":491},{"label":"ARC LINE","value":401},{"label":"SINORAN LINE","value":373},{"label":"RCL","value":308},{"label":"FORTUNA SHIPPING LIMITED","value":171},{"label":"WAN HAI","value":166},{"label":"ALLIED CONTAINER LINE","value":162}],"top_forwarders":[{"label":"PORTEVER SHANGHAI","value":1296},{"label":"CP WORLD","value":1247},{"label":"FLOWLINK","value":533},{"label":"PORTEVER NINGBO","value":514},{"label":"TOPEVER LOGISTICS (Ningbo)","value":354},{"label":"TOPEVER LOGISTICS (Shanghai)","value":309},{"label":"FAN CHENG","value":279},{"label":"CARGO CARE SHIPPING","value":278},{"label":"MCL SHIPPING","value":257},{"label":"MOLAN(HK)TRADING CO","value":247}],"top_agents":[{"label":"Blue Calm Marine","value":3124},{"label":"CARAVAN","value":760},{"label":"TRANSBAR EAST CO","value":509},{"label":"JONUB DARYA","value":464},{"label":"FANUS TALAEI","value":435},{"label":"SEVEN SEAS","value":319},{"label":"ZORRAGH NESHIN","value":262},{"label":"ARYA LAND SERVICES","value":200},{"label":"BAR O BAHR","value":166},{"label":"HAMAHANG DARYA PARS","value":137}],"top_pol":[{"label":"SHANGHAI","value":2630},{"label":"DUBAI","value":1895},{"label":"NINGBO","value":395},{"label":"NANSHA","value":192},{"label":"QINGDAO","value":191},{"label":"TIANJIN","value":62},{"label":"XINGANG","value":41},{"label":"SHEKOU","value":22},{"label":"SHENZHEN","value":5},{"label":"TAICANG","value":2}],"yearly_cont":[{"label":"2012","value":2},{"label":"2013","value":107},{"label":"2014","value":656},{"label":"2015","value":492},{"label":"2016","value":575},{"label":"2017","value":673},{"label":"2018","value":726},{"label":"2019","value":504},{"label":"2020","value":243},{"label":"2021","value":582},{"label":"2022","value":660},{"label":"2023","value":738},{"label":"2024","value":824},{"label":"2025","value":855},{"label":"2026","value":949}],"yearly_ship":[{"label":"2012","value":2},{"label":"2013","value":107},{"label":"2014","value":674},{"label":"2015","value":506},{"label":"2016","value":602},{"label":"2017","value":697},{"label":"2018","value":755},{"label":"2019","value":522},{"label":"2020","value":245},{"label":"2021","value":597},{"label":"2022","value":679},{"label":"2023","value":760},{"label":"2024","value":856},{"label":"2025","value":873},{"label":"2026","value":991}],"monthly_cont":[{"month":"2012/11","cont":2,"ship":2},{"month":"2013/01","cont":2,"ship":2},{"month":"2013/02","cont":11,"ship":11},{"month":"2013/03","cont":14,"ship":14},{"month":"2013/04","cont":14,"ship":14},{"month":"2013/05","cont":10,"ship":10},{"month":"2013/06","cont":10,"ship":10},{"month":"2013/07","cont":7,"ship":7},{"month":"2013/08","cont":9,"ship":9},{"month":"2013/09","cont":6,"ship":6},{"month":"2013/10","cont":14,"ship":14},{"month":"2013/11","cont":9,"ship":9},{"month":"2013/12","cont":1,"ship":1}],"daily":[],"rangeDays":0,"all_records":[],"pol_coords":[],"line_share":[{"label":"Blue Calm Marine","value":3124},{"label":"CARAVAN","value":760},{"label":"TRANSBAR EAST CO","value":509},{"label":"JONUB DARYA","value":464},{"label":"FANUS TALAEI","value":435}]}

// ---- Boot ----
;(async function boot() {
  // Load config
  await loadConfig()

  // Init theme
  initTheme()
  updateDateFormatBtn()

  // Init session
  checkSession()

  // Hide loading indicator (libraries are bundled by Vite)
  const libLoading = $('libLoading')
  if (libLoading) libLoading.classList.add('hide')

  // Setup chart defaults
  setupChartDefaults()

  // Render default data
  renderAll(DEFAULT_DATA as any, { filename: null, time: null })
  initFilters()

  // Try auto-fetch real data
  tryAutoFetch()

  // Auto-refresh every 5 minutes
  state.autoRefreshInterval = setInterval(() => {
    const loggedIn = localStorage.getItem('bms_logintime')
    if (loggedIn && (Date.now() - parseInt(loggedIn)) < 18e5 && !state.fetchInProgress) {
      const autoRefLabel = document.getElementById('autoRefLabel')
      if (autoRefLabel) autoRefLabel.textContent = '🔄 بروزرسانی...'
      tryAutoFetch()
    }
  }, 300000)

  // Session timeout check
  state.logoutCheckInterval = setInterval(() => {
    const t = localStorage.getItem('bms_logintime')
    if (t && (Date.now() - parseInt(t)) > 18e5) logout()
  }, 15000)
})()

// ---- Event Listeners ----
document.addEventListener('DOMContentLoaded', () => {
  // Login
  const loginBtn = $('loginBtn')
  if (loginBtn) loginBtn.addEventListener('click', doLogin)
  const loginPass = $('loginPass')
  if (loginPass) loginPass.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin() })

  // Logout
  const logoutBtn = $('logoutBtn')
  if (logoutBtn) logoutBtn.addEventListener('click', logout)

  // Theme toggle
  const themeToggle = $('themeToggle')
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme)

  // Date format toggle
  const dateModeBtn = $('dateModeBtn')
  if (dateModeBtn) dateModeBtn.addEventListener('click', toggleDateFormat)

  // Filter bar
  const fltFrom = $('fltFrom')
  const fltTo = $('fltTo')
  if (fltFrom) fltFrom.addEventListener('change', onDateChange)
  if (fltTo) fltTo.addEventListener('change', onDateChange)

  const cbFwd = $('cb-fwd')
  const cbPol = $('cb-pol')
  const cbLine = $('cb-line')
  const cbAgent = $('cb-agent')
  if (cbFwd) cbFwd.addEventListener('change', filterBySelect)
  if (cbPol) cbPol.addEventListener('change', filterBySelect)
  if (cbLine) cbLine.addEventListener('change', filterBySelect)
  if (cbAgent) cbAgent.addEventListener('change', filterBySelect)

  // Reset filters
  const resetBtn = $('resetFiltersBtn')
  if (resetBtn) resetBtn.addEventListener('click', resetFilters)

  // Export
  const exportBtn = $('exportCSVBtn')
  if (exportBtn) exportBtn.addEventListener('click', exportCSV)

  // Date presets
  const presets = ['today', '7days', '30days', 'month', 'quarter', 'year']
  presets.forEach((p) => {
    const btn = $('dp-' + p)
    if (btn) btn.addEventListener('click', () => setDatePreset(p))
  })

  // Advanced search
  const toggleAdvBtn = $('toggleAdvBtn')
  if (toggleAdvBtn) toggleAdvBtn.addEventListener('click', toggleAdvSearch)

  const advInputs = ['advVessel', 'advFwd', 'advPol', 'advLine', 'advAgent', 'advSize', 'advStatus']
  advInputs.forEach((id) => {
    const el = $(id)
    if (el) el.addEventListener('input', advSearchChange)
    if (el) el.addEventListener('change', advSearchChange)
  })

  const contSearch = $('contSearch')
  if (contSearch) contSearch.addEventListener('input', debouncedContSearch)

  // Period comparison
  const compareBtn = $('compareBtn')
  if (compareBtn) compareBtn.addEventListener('click', comparePeriods)
  const c1s = $('c1s'); const c1e = $('c1e'); const c2s = $('c2s'); const c2e = $('c2e')
  ;[c1s, c1e, c2s, c2e].forEach((el) => { if (el) el.addEventListener('change', comparePeriods) })

  // Lib banner close
  const libBannerClose = $('libBannerClose')
  if (libBannerClose) libBannerClose.addEventListener('click', () => { $('libBanner')?.classList.remove('show') })

  // Drag & Drop
  const prevent = (e: Event) => { e.preventDefault() }
  ;['dragenter', 'dragover'].forEach((evt) => document.addEventListener(evt, (e) => { prevent(e); $('dropOverlay')?.classList.add('active') }))
  ;['dragleave', 'drop'].forEach((evt) => document.addEventListener(evt, (e) => { prevent(e); if (evt === 'dragleave' && (e as DragEvent).target && (e as DragEvent).target !== $('dropOverlay')) return; $('dropOverlay')?.classList.remove('active') }))
  document.addEventListener('drop', (e) => {
    prevent(e)
    const file = (e as DragEvent).dataTransfer?.files?.[0]
    if (file) loadFile(file)
  })

  // Init date format btn
  const df = localStorage.getItem('bms_dateformat')
  if (df === 'jalali') {
    state.dateFormat = 'jalali'
    const dateModeBtn2 = $('dateModeBtn')
    if (dateModeBtn2) dateModeBtn2.textContent = '📅 شمسی'
  }
})

// Expose for debugging
;(window as any).__bms = { state }
