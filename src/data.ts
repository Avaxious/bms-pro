/* ============================================================
   BMS Dashboard — Excel Parsing & Data Processing
   ============================================================ */

import * as XLSX from 'xlsx'
import type { BmsRecord, AggResult, LabelValue, MonthlyData, DailyData, ContainerRecord, PolCoord } from './types'
import { isJalali } from './state'
import { fmtDateJalali, fmtDateMiladi, g2j, j2g } from './calendar'
import { log } from './utils'

export function findVesselSheetName(workbook: any): string {
  const names: string[] = workbook.SheetNames
  const exact = names.find((n) => n.trim().toLowerCase() === 'vessel checking')
  if (exact) return exact
  const partial = names.find((n) => n.toLowerCase().indexOf('vessel') !== -1)
  return partial || names[0]
}

export function parseRows(rows: any[][]): BmsRecord[] {
  let lastCaravan: string | null = null
  let lastVessel: string | null = null
  const records: BmsRecord[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || []
    const caravan = row[1]
    const vsl = row[3]
    const qtyRaw = row[4]
    let qty = 0
    if (qtyRaw != null) {
      const qs = String(qtyRaw).trim()
      try { qty = qs.split('+').reduce((s: number, x: string) => s + (parseInt(x) || 0), 0) } catch { qty = 0 }
    }

    const container = row[5]
    const size = row[6]
    const forwarder = row[9]
    const pol = row[10]
    const line = row[11]
    const agent = row[12]
    const dateRaw = row[14]
    let arrvDate: Date | null = null

    if (dateRaw != null && dateRaw !== '') {
      if (dateRaw instanceof Date && !isNaN(dateRaw.getTime())) {
        const d = dateRaw
        arrvDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      } else if (typeof dateRaw === 'number' && dateRaw > 40000) {
        const d = new Date((dateRaw - 25569) * 86400000)
        arrvDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      } else if (typeof dateRaw === 'string') {
        const isoMatch = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (isoMatch) {
          arrvDate = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3])
        }
        if (!arrvDate && dateRaw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)) {
          const m = dateRaw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)!
          const y = +m[1], mm = +m[2], dd = +m[3]
          if (y >= 1200 && y <= 1500) {
            const g = j2g(y, mm, dd)
            arrvDate = new Date(g[0], g[1] - 1, g[2])
          } else {
            arrvDate = new Date(y, mm - 1, dd)
          }
        }
        if (!arrvDate) {
          const numVal = Number(dateRaw)
          if (!isNaN(numVal) && numVal > 40000 && numVal < 60000) {
            const d = new Date((numVal - 25569) * 86400000)
            arrvDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
          }
        }
        if (!arrvDate && dateRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)) {
          const m = dateRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)!
          arrvDate = new Date(+m[3], +m[2] - 1, +m[1])
        }
        if (!arrvDate) {
          const tryD = new Date(dateRaw)
          if (!isNaN(tryD.getTime())) arrvDate = new Date(tryD.getFullYear(), tryD.getMonth(), tryD.getDate())
        }
      }
      if (arrvDate && isNaN(arrvDate.getTime())) arrvDate = null
    }

    if (caravan != null && caravan !== '') lastCaravan = caravan
    if (vsl != null && vsl !== '') lastVessel = String(vsl).trim()

    if ((container == null || container === '') && (row[7] == null || row[7] === '')) continue

    records.push({
      caravan: lastCaravan,
      vessel: lastVessel,
      container: container != null ? String(container).trim() : null,
      size: size != null ? String(size).trim() : null,
      qty,
      pol_forwarder: forwarder != null && String(forwarder).trim() !== '' ? String(forwarder).trim() : null,
      pol: pol != null && String(pol).trim() !== '' ? String(pol).trim() : null,
      line: line != null && String(line).trim() !== '' ? String(line).trim() : null,
      iran_agent: agent != null && String(agent).trim() !== '' ? String(agent).trim() : null,
      arrv_date: arrvDate,
      date: arrvDate,
      status: arrvDate ? 'Arrived' : 'Pending',
    })
  }
  return records
}

export function aggregateVesselSheet(workbook: any): BmsRecord[] {
  const sheetName = findVesselSheetName(workbook)
  const ws = workbook.Sheets[sheetName]
  if (!ws) return []
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

  // Header integrity check — warn if column count looks wrong
  const header = rows[0] || []
  const expectedCols = 15 // columns B through O used (indices 1–14)
  if (header.length < expectedCols) {
    log('Header column count mismatch — layout may have shifted, expected ~' + expectedCols + ' got ' + header.length)
  }

  return parseRows(rows)
}

// ---- Aggregation Engine ----

function contCount(arr: { container?: string | null }[]): number {
  const s = new Set(arr.filter((r) => r.container).map((r) => r.container))
  return s.size
}

function shipCount(arr: { qty: number }[]): number {
  return arr.reduce((sum, r) => sum + r.qty, 0)
}

function topNbyCount(records: BmsRecord[], key: keyof BmsRecord, n: number): LabelValue[] {
  const m = new Map<string, BmsRecord[]>()
  records.forEach((r) => {
    const k = r[key] as string | null
    if (!k) return
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
  })
  const arr = Array.from(m.entries()).map(([lbl, recs]) => ({ label: lbl, value: contCount(recs) }))
  arr.sort((a, b) => b.value - a.value)
  return arr.slice(0, n)
}

export function aggregateFromRecords(records: BmsRecord[]): AggResult {
  const isJal = isJalali()
  const fmtDate = (d: Date) => isJal ? fmtDateJalali(d) : fmtDateMiladi(d)

  const total_containers = contCount(records)
  const total_shipments = shipCount(records)
  const vesselSet = new Set(records.map((r) => r.vessel).filter(Boolean))
  const lineSet = new Set(records.map((r) => r.line).filter(Boolean))
  const fwdSet = new Set(records.map((r) => r.pol_forwarder).filter(Boolean))
  const agentSet = new Set(records.map((r) => r.iran_agent).filter(Boolean))

  const sizeMap = new Map<string, number>()
  records.forEach((r) => { if (r.size) sizeMap.set(r.size, (sizeMap.get(r.size) || 0) + 1) })

  const pending = records.filter((r) => r.status === 'Pending')
  const arrived = records.filter((r) => r.status === 'Arrived')

  // Yearly
  const yearMap = new Map<number, BmsRecord[]>()
  records.forEach((r) => {
    if (r.date) { const y = r.date.getFullYear(); if (!yearMap.has(y)) yearMap.set(y, []); yearMap.get(y)!.push(r) }
  })
  const yearSorted = Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0])
  const yearly_cont = yearSorted.map(([y, recs]) => ({ label: String(y), value: contCount(recs) }))
  const yearly_ship = yearSorted.map(([y, recs]) => ({ label: String(y), value: shipCount(recs) }))

  // Monthly
  const monthMap = new Map<string, BmsRecord[]>()
  records.forEach((r) => {
    if (r.date) {
      const y = r.date.getFullYear()
      const m = String(r.date.getMonth() + 1).padStart(2, '0')
      const key = y + '-' + m
      if (!monthMap.has(key)) monthMap.set(key, [])
      monthMap.get(key)!.push(r)
    }
  })
  const monthSorted = Array.from(monthMap.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const monthly_cont: MonthlyData[] = monthSorted.map(([key, recs]) => {
    let lbl = key
    if (isJal) {
      const parts = key.split('-')
      const j = g2j(parseInt(parts[0]), parseInt(parts[1]), 1)
      lbl = j[0] + '/' + String(j[1]).padStart(2, '0')
    }
    return { month: lbl, cont: contCount(recs), ship: shipCount(recs) }
  })

  // Size dist
  const size_dist: LabelValue[] = Array.from(sizeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  // Daily
  const dayMap = new Map<string, BmsRecord[]>()
  records.forEach((r) => {
    if (r.date) {
      const key = r.date.getFullYear() + '-' + String(r.date.getMonth() + 1).padStart(2, '0') + '-' + String(r.date.getDate()).padStart(2, '0')
      if (!dayMap.has(key)) dayMap.set(key, [])
      dayMap.get(key)!.push(r)
    }
  })
  const dayKeys = Array.from(dayMap.keys()).sort()
  const daily: DailyData[] = []
  if (dayKeys.length) {
    const minD = new Date(dayKeys[0] + 'T00:00:00')
    const maxD = new Date(dayKeys[dayKeys.length - 1] + 'T00:00:00')
    for (const d = new Date(minD); d <= maxD; d.setDate(d.getDate() + 1)) {
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      const arr = dayMap.get(key) || []
      daily.push({ label: fmtDate(d), cont: arr.length ? contCount(arr) : 0, ship: arr.length ? shipCount(arr) : 0 })
    }
  }

  // All records for container list
  const all_records: ContainerRecord[] = records.map((r) => ({
    container: r.container || null,
    vessel: r.vessel || null,
    size: r.size || null,
    qty: r.qty || 0,
    pol_forwarder: r.pol_forwarder || null,
    pol: r.pol || null,
    line: r.line || null,
    iran_agent: r.iran_agent || null,
    date: r.date ? fmtDate(r.date) : '',
    status: r.status || '',
  }))

  // POL coords
  const POL_COORDS: Record<string, [number, number]> = {
    SHANGHAI: [31.23, 121.47], NINGBO: [29.87, 121.54], NANSHA: [22.76, 113.62],
    QINGDAO: [36.07, 120.38], TIANJIN: [38.97, 117.72], XINGANG: [38.98, 117.75],
    SHEKOU: [22.48, 113.91], SHENZHEN: [22.54, 113.96], TAICANG: [31.45, 121.12],
    DUBAI: [25.20, 55.27], BANDAR_ABBAS: [27.18, 56.27],
  }
  const polCountMap = new Map<string, number>()
  records.forEach((r) => { if (r.pol && r.date) polCountMap.set(r.pol, (polCountMap.get(r.pol) || 0) + 1) })
  const pol_coords: PolCoord[] = Array.from(polCountMap.entries())
    .filter(([name]) => POL_COORDS[name.toUpperCase()])
    .map(([name, count]) => ({ name, lat: POL_COORDS[name.toUpperCase()][0], lng: POL_COORDS[name.toUpperCase()][1], count }))

  // Date range
  const dates = records.map((r) => r.date).filter(Boolean) as Date[]
  const date_min = dates.length ? fmtDate(new Date(dates.reduce((m, d) => Math.min(m, d.getTime()), Infinity))) : null
  const date_max = dates.length ? fmtDate(new Date(dates.reduce((m, d) => Math.max(m, d.getTime()), -Infinity))) : null

  // TEU
  const total_teu = records.reduce((s, r) => {
    const sz = r.size
    return s + (sz === '40' || sz === "40'" ? 2 : sz === '20' || sz === "20'" ? 1 : 0)
  }, 0)

  return {
    total_containers, total_shipments, total_teu,
    unique_vessels: vesselSet.size, unique_lines: lineSet.size,
    unique_forwarders: fwdSet.size, unique_agents: agentSet.size,
    date_min, date_max,
    pending_count: contCount(pending), arrived_count: contCount(arrived),
    size_dist, top_lines: topNbyCount(records, 'line', 10),
    top_forwarders: topNbyCount(records, 'pol_forwarder', 10),
    top_agents: topNbyCount(records, 'iran_agent', 10),
    top_pol: topNbyCount(records, 'pol', 10),
    yearly_cont, yearly_ship, monthly_cont,
    daily, rangeDays: daily.length,
    all_records, pol_coords,
  }
}

export function aggregateAsync(
  records: BmsRecord[],
  filterParams: { dateFormat: string },
  callback: (data: AggResult | null) => void,
  stateObj: any,
) {
  if (stateObj.worker && stateObj.workerReady && !stateObj.workerBusy) {
    stateObj.workerBusy = true
    let called = false
    const safeCallback = (data: AggResult | null) => {
      if (called) return
      called = true
      callback(data)
    }
    stateObj.workerCallback = safeCallback
    stateObj.workerFallback = setTimeout(() => {
      stateObj.workerBusy = false
      stateObj.workerCallback = null
      stateObj.workerReady = false
      safeCallback(aggregateFromRecords(records))
    }, 5000)
    try {
      const safeRecords = records.map((r) => ({
        container: r.container, vessel: r.vessel, size: r.size, qty: r.qty,
        pol_forwarder: r.pol_forwarder, pol: r.pol, line: r.line,
        iran_agent: r.iran_agent,
        dateStr: r.date ? (r.date.getFullYear() + '-' + String(r.date.getMonth() + 1).padStart(2, '0') + '-' + String(r.date.getDate()).padStart(2, '0')) : '',
        arrv_dateStr: r.arrv_date ? (r.arrv_date.getFullYear() + '-' + String(r.arrv_date.getMonth() + 1).padStart(2, '0') + '-' + String(r.arrv_date.getDate()).padStart(2, '0')) : '',
        status: r.status,
      }))
      stateObj.worker.postMessage({ type: 'aggregate', records: safeRecords, filters: filterParams })
    } catch {
      clearTimeout(stateObj.workerFallback)
      stateObj.workerFallback = null
      stateObj.workerBusy = false
      stateObj.workerCallback = null
      stateObj.workerReady = false
      safeCallback(aggregateFromRecords(records))
    }
  } else {
    callback(aggregateFromRecords(records))
  }
}
