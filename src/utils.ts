/* ============================================================
   BMS Dashboard — Utility Functions
   ============================================================ */

const DEBUG = false

export function log(...args: unknown[]) {
  if (DEBUG) console.log(...args)
}

export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeHtml(s: unknown): string {
  const d = document.createElement('div')
  d.textContent = String(s)
  return d.innerHTML
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n || 0))
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let t: ReturnType<typeof setTimeout>
  return function (this: unknown, ...args: unknown[]) {
    clearTimeout(t)
    t = setTimeout(() => fn.apply(this, args), delay)
  } as unknown as T
}

export async function sha256(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
