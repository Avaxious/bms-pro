/* ============================================================
   BMS Dashboard — Chart Rendering
   ============================================================ */

import Chart from 'chart.js/auto'
import { state, $, isJalali, safeGet, safeSet } from './state'
import { fmtInt, esc } from './utils'
import { renderMap } from './map'
import { renderContainerList } from './ui'
import type { AggResult, Meta } from './types'

export const COLORS = {
  teal: '#22C0AE',
  tealSoft: 'rgba(34,192,174,.55)',
  tealFill: 'rgba(34,192,174,.14)',
  gold: '#E8AE52',
  goldFill: 'rgba(232,174,82,.14)',
  red: '#E5654A',
  blue: '#5B9BD5',
  grid: 'rgba(120,170,210,.10)',
  palette: ['#22C0AE', '#E8AE52', '#5B9BD5', '#B08CE0', '#E5654A', '#6FCF97', '#F2C94C', '#9BA8C9', '#2FA6A0', '#D98CC0'],
}

export function chartTextColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#A8BDD6'
}

export function setupChartDefaults() {
  Chart.defaults.font.family = "'IBM Plex Mono', monospace"
  Chart.defaults.color = chartTextColor()
  Chart.defaults.font.size = 10.5
}

export function getOrCreateChart(id: string, cfg: any): Chart {
  if (state.charts[id]) {
    state.charts[id].data = cfg.data
    Object.assign(state.charts[id].options, cfg.options)
    state.charts[id].update()
    return state.charts[id]
  }
  state.charts[id] = new Chart(document.getElementById(id) as HTMLCanvasElement, cfg)
  return state.charts[id]
}

function hbar(id: string, items: { label: string; value: number }[], color: string) {
  getOrCreateChart(id, {
    type: 'bar',
    data: {
      labels: items.map((d) => d.label.length > 26 ? d.label.slice(0, 24) + '\u2026' : d.label),
      datasets: [{ data: items.map((d) => d.value), backgroundColor: color, borderRadius: 4, maxBarThickness: 16 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => c.dataset.label + ': ' + fmtInt(c.parsed.x) } } },
      scales: {
        x: { grid: { color: COLORS.grid }, ticks: { callback: (v: any) => fmtInt(v), color: chartTextColor() } },
        y: { grid: { display: false }, ticks: { font: { size: 10 }, color: chartTextColor() } },
      },
    },
  })
}

export function renderAll(v: AggResult, meta: Meta | null) {
  const pp = v.prevPeriod

  function trendHtml(cur: number, prev: number | undefined | null): string {
    if (prev == null) return ''
    const diff = cur - prev
    const pct = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : '∞'
    const cls = diff > 0 ? 'up' : diff < 0 ? 'dn' : 'flat'
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—'
    return '<div class="trend ' + cls + '">' + arrow + ' ' + pct + '%</div>'
  }

  const kpiGrid = $('kpiGrid')
  if (kpiGrid) {
    kpiGrid.innerHTML = [
      { lbl: 'کل کانتینرها (ستون F)', val: fmtInt(v.total_containers), sub: 'CONTAINERS', cls: 'accent-teal', cur: v.total_containers, prev: pp ? pp.total_containers : null },
      { lbl: 'کل بارنامه (ستون E)', val: fmtInt(v.total_shipments), sub: 'SHIPMENTS', cls: 'accent-gold', cur: v.total_shipments, prev: pp ? pp.total_shipments : null },
      { lbl: 'TEU', val: fmtInt(v.total_teu || 0), sub: 'TWENTY-FOOT EQUIVALENT', cls: 'accent-red', cur: v.total_teu || 0, prev: pp ? pp.total_teu || 0 : null },
      { lbl: 'سفرهای دریایی', val: fmtInt(v.unique_vessels), sub: 'VESSEL / VOYAGE', cls: '', cur: v.unique_vessels, prev: pp ? pp.unique_vessels : null },
      { lbl: 'خطوط کشتیرانی', val: fmtInt(v.unique_lines), sub: 'SHIPPING LINES', cls: '', cur: v.unique_lines, prev: pp ? pp.unique_lines : null },
      { lbl: 'فورواردرهای POL', val: fmtInt(v.unique_forwarders), sub: 'POL FORWARDERS', cls: '', cur: v.unique_forwarders, prev: pp ? pp.unique_forwarders : null },
      { lbl: 'نمایندگان ایران', val: fmtInt(v.unique_agents), sub: 'IRAN AGENTS', cls: '', cur: v.unique_agents, prev: pp ? pp.unique_agents : null },
    ].map((k) => '<div class="kpi ' + k.cls + '"><div class="lbl">' + k.lbl + '</div><div class="val">' + k.val + '</div>' + trendHtml(k.cur, k.prev) + '<div class="sub">' + k.sub + '</div></div>').join('')
  }

  // Auto Period Comparison
  const cmpSection = $('autoCmpSection')
  if (pp && cmpSection) {
    cmpSection.style.display = ''
    const autoCmpTitle = $('autoCmpTitle')
    if (autoCmpTitle) autoCmpTitle.textContent = 'مقایسه با دوره قبل: ' + v.prevPeriodLabel
    const cmpItems = [
      { lbl: 'کانتینر', cur: v.total_containers, prev: pp.total_containers },
      { lbl: 'بارنامه', cur: v.total_shipments, prev: pp.total_shipments },
      { lbl: 'TEU', cur: v.total_teu || 0, prev: pp.total_teu || 0 },
      { lbl: 'کشتی', cur: v.unique_vessels, prev: pp.unique_vessels },
      { lbl: 'خط کشتیرانی', cur: v.unique_lines, prev: pp.unique_lines },
      { lbl: 'فورواردر', cur: v.unique_forwarders, prev: pp.unique_forwarders },
      { lbl: 'ایجنت ایران', cur: v.unique_agents, prev: pp.unique_agents },
    ]
    const autoCmpBox = $('autoCmpBox')
    if (autoCmpBox) {
      autoCmpBox.innerHTML = '<div class="cmp-sub">بازه فعلی: ' + esc(v.curPeriodLabel) + '</div><div class="auto-cmp-row">' + cmpItems.map((it) => {
        const diff = it.cur - it.prev
        const pct = it.prev !== 0 ? ((diff / it.prev) * 100).toFixed(1) : '∞'
        const cls = diff > 0 ? 'up' : diff < 0 ? 'dn' : 'flat'
        const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—'
        return '<div class="auto-cmp-item"><div class="ac-label">' + it.lbl + '</div><div class="ac-cur ' + cls + '">' + fmtInt(it.cur) + '</div><div class="ac-prev">دوره قبل: ' + fmtInt(it.prev) + '</div><div class="ac-change ' + cls + '">' + arrow + ' ' + pct + '%</div></div>'
      }).join('') + '</div>'
    }
  } else if (cmpSection) {
    cmpSection.style.display = 'none'
  }

  // Determine granularity
  let rd = v.rangeDays || 0, gran = 'yearly', granLabel = 'سالانه'
  if (rd <= 31) { gran = 'daily'; granLabel = 'روزانه' }
  else if (rd <= 365) { gran = 'monthly'; granLabel = 'ماهانه' }

  const chart1Title = $('chart1Title')
  const monthSectionTitle = $('monthSectionTitle')
  const chart2Title = $('chart2Title')
  const yearlyDesc = $('yearlyDesc')
  if (chart1Title) chart1Title.textContent = 'روند ' + granLabel
  if (monthSectionTitle) monthSectionTitle.textContent = 'روند حجم عملیات (' + granLabel + ')'
  if (chart2Title) chart2Title.textContent = 'حجم ' + granLabel
  if (yearlyDesc) yearlyDesc.textContent = 'بازه: ' + (v.date_min || '—') + ' تا ' + (v.date_max || '—') + ' · نمایش ' + granLabel

  // Chart heights for daily
  const chartYearlyEl = $('chartYearly')
  if (chartYearlyEl) chartYearlyEl.parentElement!.style.height = gran === 'daily' ? '340px' : ''
  const chartMonthlyEl = $('chartMonthly')
  if (chartMonthlyEl) chartMonthlyEl.parentElement!.style.height = gran === 'daily' ? '280px' : ''

  // Chart 1: grouped bar
  let c1labels: string[], c1cont: number[], c1ship: number[]
  if (gran === 'daily') {
    c1labels = v.daily.map((d) => d.label); c1cont = v.daily.map((d) => d.cont); c1ship = v.daily.map((d) => d.ship)
  } else if (gran === 'monthly') {
    c1labels = v.monthly_cont.map((d) => d.month); c1cont = v.monthly_cont.map((d) => d.cont); c1ship = v.monthly_cont.map((d) => d.ship)
  } else {
    c1labels = v.yearly_cont.map((d) => String(d.label)); c1cont = v.yearly_cont.map((d) => d.value); c1ship = v.yearly_ship.map((d) => d.value)
  }

  getOrCreateChart('chartYearly', {
    type: 'bar',
    data: {
      labels: c1labels,
      datasets: [
        { label: 'کانتینر', data: c1cont, backgroundColor: COLORS.teal, borderRadius: 4 },
        { label: 'بارنامه', data: c1ship, backgroundColor: COLORS.gold, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 }, color: chartTextColor(), usePointStyle: true } }, tooltip: { callbacks: { label: (c: any) => c.dataset.label + ': ' + fmtInt(c.parsed.y) } } },
      scales: { x: { stacked: false, grid: { display: false }, ticks: { font: { size: 10 }, color: chartTextColor() } }, y: { grid: { color: COLORS.grid }, ticks: { callback: (v: any) => fmtInt(v), color: chartTextColor() } } },
    },
  })

  // Map
  renderMap(v)

  // Chart 2: line
  let c2labels: string[], c2cont: number[], c2ship: number[], c2desc: string
  if (gran === 'daily') {
    c2labels = v.daily.map((d) => d.label); c2cont = v.daily.map((d) => d.cont); c2ship = v.daily.map((d) => d.ship); c2desc = v.daily.length + ' روز'
  } else if (gran === 'monthly') {
    c2labels = v.monthly_cont.map((d) => d.month); c2cont = v.monthly_cont.map((d) => d.cont); c2ship = v.monthly_cont.map((d) => d.ship); c2desc = v.monthly_cont.length + ' ماه'
  } else {
    c2labels = v.yearly_cont.map((d) => String(d.label)); c2cont = v.yearly_cont.map((d) => d.value); c2ship = v.yearly_ship.map((d) => d.value); c2desc = v.yearly_cont.length + ' سال'
  }

  const monthlyDesc = $('monthlyDesc')
  if (monthlyDesc) monthlyDesc.textContent = c2desc

  getOrCreateChart('chartMonthly', {
    type: 'line',
    data: {
      labels: c2labels,
      datasets: [
        { label: 'کانتینر', data: c2cont, borderColor: COLORS.teal, backgroundColor: COLORS.tealFill, fill: false, tension: .35, pointRadius: 3, pointBackgroundColor: COLORS.teal, pointBorderColor: '#04150f', borderWidth: 2 },
        { label: 'بارنامه', data: c2ship, borderColor: COLORS.gold, backgroundColor: COLORS.goldFill, fill: false, tension: .35, pointRadius: 3, pointBackgroundColor: COLORS.gold, pointBorderColor: '#04150f', borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 }, color: chartTextColor(), usePointStyle: true } }, tooltip: { callbacks: { label: (c: any) => c.dataset.label + ': ' + fmtInt(c.parsed.y) } } },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 60, minRotation: 60, font: { size: 9 }, color: chartTextColor() } }, y: { grid: { color: COLORS.grid }, ticks: { callback: (v: any) => fmtInt(v), color: chartTextColor() } } },
    },
  })

      // Iran Agent Share Pie
      const agentData = v.top_agents.slice(0, 10)
      if (agentData.length) {
        getOrCreateChart('chartLinesPie', {
          type: 'doughnut',
          data: {
            labels: agentData.map((d) => d.label),
            datasets: [{ data: agentData.map((d) => d.value), backgroundColor: COLORS.palette, borderColor: '#0F2A45', borderWidth: 2 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '55%',
            plugins: {
              legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, color: chartTextColor() } },
              tooltip: { callbacks: { label: (c: any) => c.label + ': ' + fmtInt(c.parsed) + ' کانتینر' } }
            },
          },
        })
      } else if (state.charts['chartLinesPie']) {
        state.charts['chartLinesPie'].destroy()
        delete state.charts['chartLinesPie']
      }

  hbar('chartForwarders', v.top_forwarders, COLORS.gold)
  hbar('chartLines', v.top_lines, COLORS.blue)

  // POL doughnut
  getOrCreateChart('chartPOL', {
    type: 'doughnut',
    data: { labels: v.top_pol.map((d) => d.label), datasets: [{ data: v.top_pol.map((d) => d.value), backgroundColor: COLORS.palette, borderColor: '#0F2A45', borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, color: chartTextColor() } }, tooltip: { callbacks: { label: (c: any) => c.label + ': ' + fmtInt(c.parsed) + ' کانتینر' } } } },
  })

  // Size doughnut
  getOrCreateChart('chartSize', {
    type: 'doughnut',
    data: { labels: v.size_dist.map((d) => d.label + "'"), datasets: [{ data: v.size_dist.map((d) => d.value), backgroundColor: v.size_dist.map((_, i) => COLORS.palette[i % COLORS.palette.length]), borderColor: '#0F2A45', borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => c.label + ': ' + fmtInt(c.parsed) + ' کانتینر' } } } },
  })

  const sizeLegend = $('sizeLegend')
  if (sizeLegend) {
    const sizeTotal = v.size_dist.reduce((s, d) => s + d.value, 0)
    sizeLegend.innerHTML = v.size_dist.map((d, i) => '<span><i style="background:' + COLORS.palette[i % COLORS.palette.length] + '"></i> کانتینر ' + esc(d.label) + "': " + fmtInt(d.value) + ' (' + (sizeTotal ? (d.value / sizeTotal * 100).toFixed(1) : 0) + '%)</span>').join('')
  }

  // Container list
  renderContainerList(v.all_records)

  const lastLoaded = $('lastLoaded')
  if (meta && lastLoaded) lastLoaded.textContent = meta.time || '—'
}

export function toggleTheme() {
  const html = document.documentElement
  const cur = html.getAttribute('data-theme')
  const next = cur === 'light' ? 'dark' : 'light'
  html.setAttribute('data-theme', next)
  safeSet('bms_theme', next)
  const themeToggle = $('themeToggle')
  if (themeToggle) themeToggle.textContent = next === 'light' ? '☀️' : '🌙'
  const tc = chartTextColor()
  Chart.defaults.color = tc
  Object.keys(state.charts).forEach((k) => {
    if (state.charts[k]) {
      const c = state.charts[k]
      if (c.options.plugins?.legend?.labels) c.options.plugins.legend.labels.color = tc
      if (c.options.scales) {
        Object.keys(c.options.scales).forEach((sk) => {
          const sc = (c.options.scales as any)[sk]
          if (sc.ticks) sc.ticks.color = tc
        })
      }
      c.update()
    }
  })
}

export function initTheme() {
  const saved = safeGet('bms_theme')
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
    const themeToggle = $('themeToggle')
    if (themeToggle) themeToggle.textContent = '☀️'
  }
}

export function updateDateFormatBtn() {
  const df = safeGet('bms_dateformat')
  if (df === 'jalali') {
    state.dateFormat = 'jalali'
    const btn = $('dateModeBtn')
    if (btn) btn.textContent = '📅 شمسی'
  }
}
