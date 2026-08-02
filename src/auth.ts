/* ============================================================
   BMS Dashboard — Authentication
   ============================================================ */

import { state, $, safeGet, safeSet, safeRemove } from './state'
import { sha256 } from './utils'
import { log } from './utils'

const SESSION_DURATION = 72e5 // 2 hours

export let PROXY_URL = ''
export let LOGIN_PROXY_URL = ''

export async function loadConfig() {
  try {
    const cfgResp = await fetch('config.json', { signal: AbortSignal.timeout(8000) })
    if (cfgResp.ok) {
      const cfg = await cfgResp.json()
      if (cfg.PROXY_URL) PROXY_URL = cfg.PROXY_URL
      if (cfg.LOGIN_PROXY_URL) LOGIN_PROXY_URL = cfg.LOGIN_PROXY_URL
    }
  } catch (e) {
    log('Config load failed:', e)
  }
}

export function updateTimer() {
  const t = safeGet('bms_logintime')
  if (!t) return
  const el = $('timerDisplay')
  if (!el) return
  const remaining = Math.max(0, SESSION_DURATION - (Date.now() - parseInt(t)))
  const m = Math.floor(remaining / 60000)
  const s = Math.floor((remaining % 60000) / 1000)
  el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
  if (remaining <= 0) logout()
}

export async function doLogin() {
  const userEl = $('loginUser') as HTMLInputElement | null
  const passEl = $('loginPass') as HTMLInputElement | null
  const errEl = $('loginErr')
  const btn = $('loginBtn')

  const user = userEl?.value.trim() || ''
  const pass = passEl?.value.trim() || ''

  if (!user || !pass) {
    if (errEl) { errEl.textContent = '❌ لطفاً نام کاربری و رمز عبور را وارد کنید'; errEl.style.display = 'block' }
    return
  }

  if (btn) { btn.classList.add('loading'); btn.textContent = '⏳ در حال بررسی…' }

  try {
    const hash = await sha256(pass)
    const resp = await fetch(LOGIN_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', user, hash }),
      signal: AbortSignal.timeout(15000),
    })
    const text = await resp.text()
    let data: { ok?: boolean; token?: string }
    try { data = JSON.parse(text) } catch { data = { ok: false } }

    if (data.ok && data.token) {
      const now = Date.now().toString()
      safeSet('bms_token', data.token)
      safeSet('bms_logintime', now)
      safeSet('bms_username', user)
      safeSet('bms_migrated', '1')

      const userDisplay = $('userDisplay')
      const welcomeUser = $('welcomeUser')
      const timerChip = $('timerChip')
      const splash = $('splash')

      if (userDisplay) userDisplay.textContent = user
      if (welcomeUser) welcomeUser.style.display = ''
      if (timerChip) timerChip.style.display = ''
      updateTimer()
      if (splash) splash.classList.remove('show')
      if (state.onLoginSuccess) state.onLoginSuccess()
    } else {
      if (errEl) { errEl.textContent = '❌ نام کاربری یا رمز عبور اشتباه است'; errEl.style.display = 'block' }
      if (btn) { btn.classList.remove('loading'); btn.textContent = 'ورود به داشبورد ←' }
    }
  } catch (e) {
    if (errEl) { errEl.textContent = '❌ خطا در ارتباط با سرور ورود'; errEl.style.display = 'block' }
    if (btn) { btn.classList.remove('loading'); btn.textContent = 'ورود به داشبورد ←' }
  }
}

export function logout() {
  const token = safeGet('bms_token')
  if (token) {
    try {
      fetch(LOGIN_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'logout', token }),
        signal: AbortSignal.timeout(5000),
      })
    } catch (e) { /* ignore */ }
  }

  safeRemove('bms_token')
  safeRemove('bms_username')
  safeRemove('bms_logintime')

  const splash = $('splash')
  const loginUser = $('loginUser') as HTMLInputElement | null
  const loginPass = $('loginPass') as HTMLInputElement | null
  const loginErr = $('loginErr')
  const loginBtn = $('loginBtn')
  const welcomeUser = $('welcomeUser')
  const timerChip = $('timerChip')

  if (splash) splash.classList.add('show')
  if (loginUser) loginUser.value = ''
  if (loginPass) loginPass.value = ''
  if (loginErr) loginErr.style.display = 'none'
  if (loginBtn) { loginBtn.classList.remove('loading'); loginBtn.textContent = 'ورود به داشبورد ←' }
  if (welcomeUser) welcomeUser.style.display = 'none'
  if (timerChip) timerChip.style.display = 'none'

  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null }
  if (state.logoutCheckInterval) { clearInterval(state.logoutCheckInterval); state.logoutCheckInterval = null }
  if (state.autoRefreshInterval) { clearInterval(state.autoRefreshInterval); state.autoRefreshInterval = null }
}

export function checkSession() {
  const t = safeGet('bms_logintime')
  if (t && (Date.now() - parseInt(t)) < SESSION_DURATION) {
    const u = safeGet('bms_username')
    const tok = safeGet('bms_token')
    if (u && tok) {
      const userDisplay = $('userDisplay')
      const welcomeUser = $('welcomeUser')
      const splash = $('splash')
      const timerChip = $('timerChip')
      if (userDisplay) userDisplay.textContent = u
      if (welcomeUser) welcomeUser.style.display = ''
      if (splash) splash.classList.remove('show')
      if (timerChip) timerChip.style.display = ''
      updateTimer()
      state.timerInterval = setInterval(updateTimer, 1000)
    }
  } else {
    safeRemove('bms_token')
    safeRemove('bms_logintime')
    safeRemove('bms_username')
    safeRemove('bms_migrated')
    const splash = $('splash')
    if (splash) splash.classList.add('show')
  }
}
