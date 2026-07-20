/* ============================================================
   BMS Dashboard — Excel Export
   ============================================================ */

import * as XLSX from 'xlsx'
import { isJalali } from './state'
import { getFilteredRecords } from './filter'
import { showToast } from './ui'
import { fmtDateMiladi, fmtDateJalali } from './calendar'

export function exportCSV() {
  const records = getFilteredRecords()
  if (!records.length) { showToast('داده‌ای برای خروجی وجود ندارد', true); return }
  if (typeof XLSX === 'undefined') { showToast('❌ کتابخانهٔ اکسل در دسترس نیست', true); return }

  const header = ['Month', 'Line', 'Iran Agent', 'POL Forwarder', 'POL', 'Container', 'Size', 'Vessel', 'Caravan', 'Status', 'Qty']
  const rows = [header]
  const fmtDate = (d: Date) => isJalali() ? fmtDateJalali(d) : fmtDateMiladi(d)

  records.forEach((r) => {
    const dateStr = r.arrv_date ? fmtDate(r.arrv_date) : ''
    rows.push([dateStr, r.line || '', r.iran_agent || '', r.pol_forwarder || '', r.pol || '', r.container || '', r.size || '', r.vessel || '', r.caravan || '', r.status || '', String(r.qty || 0)])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 8 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Vessel Checking')
  XLSX.writeFile(wb, 'Vessel_Checking_Export_' + fmtDateMiladi(new Date()) + '.xlsx')
  showToast('✅ فایل Excel با ' + records.length.toLocaleString() + ' ردیف دانلود شد.', false)
}
