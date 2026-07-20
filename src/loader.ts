/* ============================================================
   BMS Dashboard — Data Loader (Google Sheets / Local File)
   ============================================================ */

import * as XLSX from 'xlsx'
import { state, $ } from './state'
import { log } from './utils'
import { parseRows, aggregateVesselSheet } from './data'
import { initFilters, refreshDashboard } from './filter'
import { showToast, showBanner } from './ui'
import { PROXY_URL } from './auth'
import type { Meta, BmsRecord } from './types'

export async function decryptData(buf: ArrayBuffer, password: string): Promise<ArrayBuffer | null> {
  try {
    const data = new Uint8Array(buf)
    const salt = data.slice(0, 16)
    const iv = data.slice(16, 28)
    const ct = data.slice(28)
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  } catch {
    showToast('❌ رمز عبور اشتباه است یا فایل خراب است', true)
    return null
  }
}

export function showPasswordModal(): Promise<string | null> {
  return new Promise((resolve) => {
    const m = $('pwdModal')
    const inp = $('pwdInput') as HTMLInputElement | null
    if (!m || !inp) { resolve(null); return }
    m.classList.add('show')
    inp.value = ''
    inp.focus()
    const okBtn = m.querySelector('.ok') as HTMLElement | null
    const cancelBtn = m.querySelector('.cancel') as HTMLElement | null
    const close = (val: string | null) => { m.classList.remove('show'); resolve(val) }
    if (okBtn) okBtn.onclick = () => close(inp.value)
    if (cancelBtn) cancelBtn.onclick = () => close(null)
    inp.onkeydown = (e) => { if (e.key === 'Enter') close(inp.value) }
  })
}

export async function fetchGoogleSheet(): Promise<BmsRecord[] | null> {
  const token = localStorage.getItem('bms_token')
  if (!token) return null

  try {
    const pb = $('progFill')
    if (pb) (pb as HTMLElement).style.width = '30%'
    const autoRefLabel = $('autoRefLabel')
    if (autoRefLabel) autoRefLabel.textContent = '⏳ دریافت دیتا از سرور...'

    const resp = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(30000),
    })
    if (!resp.ok) return null

    if (pb) (pb as HTMLElement).style.width = '60%'
    if (autoRefLabel) autoRefLabel.textContent = '⏳ پردازش دیتا...'

    const csv = await resp.text()
    if (csv === 'Forbidden') {
      showBanner('<b>⚠️ اتصال به سرور دیتا ممکن نیست.</b><br>لطفاً از صفحه خارج شده دوباره وارد شوید. (توکن شما هنوز معتبر است)')
      return null
    }

    const wb = XLSX.read(csv, { type: 'string', raw: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
    if (rows.length < 2) return null

    if (pb) (pb as HTMLElement).style.width = '90%'
    const records = parseRows(rows)
    if (pb) (pb as HTMLElement).style.width = '100%'
    setTimeout(() => { if (pb) (pb as HTMLElement).style.width = '0%' }, 600)
    return records
  } catch {
    const pb = $('progFill')
    if (pb) (pb as HTMLElement).style.width = '0%'
    return null
  }
}

export async function tryAutoFetch() {
  if (state.fetchInProgress) return
  state.fetchInProgress = true

  try {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'

    if (!isLocal) {
      const gsRecords = await fetchGoogleSheet()
      if (gsRecords && gsRecords.length) {
        state.rawRecords = gsRecords
        state.currentMeta = { time: new Date().toLocaleString('fa-IR') }
        initFilters()
        refreshDashboard()
        showToast('✅ دیتا از Google Sheets بارگذاری شد (' + gsRecords.length.toLocaleString() + ' رکورد)', false)
        const autoRefLabel = $('autoRefLabel')
        if (autoRefLabel) autoRefLabel.textContent = '🔄 ' + new Date().toLocaleTimeString('fa-IR')
        return
      }

      try {
        const resp = await fetch('data.enc')
        if (resp.ok) {
          const buf = await resp.arrayBuffer()
          const pw = await showPasswordModal()
          if (pw) {
            const dec = await decryptData(buf, pw)
            if (dec) { processArrayBuffer(dec, 'data.xlsx (encrypted)'); return }
          }
        }
      } catch { /* ignore */ }
    }

    const filenames = ['data.xlsx', 'data.xlsm', 'Copy of Vesel Checking & Pending(M.H).xlsm', 'Copy of Vesel Checking & Pending(M.H).xlsx', 'Vessel_Checking.xlsm', 'Vessel_Checking.xlsx', 'dashboard.xlsm', 'dashboard.xlsx']
    for (const name of filenames) {
      try {
        const resp = await fetch(encodeURI(name))
        if (!resp.ok) continue
        const buf = await resp.arrayBuffer()
        processArrayBuffer(buf, name)
        return
      } catch { /* continue */ }
    }
  } finally {
    state.fetchInProgress = false
  }
}

export function processArrayBuffer(buf: ArrayBuffer, filename: string) {
  if (typeof XLSX === 'undefined') {
    showToast('❌ کتابخانهٔ اکسل بارگذاری نشد — VPN روشن کنید و رفرش کنید', true)
    return
  }
  try {
    const workbook = XLSX.read(buf, { type: 'array', cellDates: false })
    state.rawRecords = aggregateVesselSheet(workbook)
    const now = new Date()
    const timeStr = now.toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' })
    state.currentMeta = { filename, time: timeStr }
    initFilters()
    refreshDashboard()
    showToast('✅ داشبورد از «' + filename + '» به‌روزرسانی شد (' + state.rawRecords.length.toLocaleString() + ' رکورد)', false)
    const autoRef = $('autoRefLabel')
    if (autoRef) autoRef.textContent = '🔄 ' + new Date().toLocaleTimeString('fa-IR')
  } catch (err: any) {
    log('ERROR:', err)
    showToast('❌ خطا: ' + err.message, true)
  }
}

export function loadFile(file: File | undefined) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => processArrayBuffer(e.target!.result as ArrayBuffer, file.name)
  reader.onerror = () => showToast('❌ خطا در خواندن فایل', true)
  reader.readAsArrayBuffer(file)
}
