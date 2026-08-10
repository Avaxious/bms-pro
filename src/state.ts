/* ============================================================
   BMS Dashboard — Centralized State
   ============================================================ */

import type { BmsRecord, FilterState, Meta } from './types'

export function safeGet(key: string, fallback: string | null = null): string | null {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
export function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}
export function safeRemove(key: string): void {
  try { localStorage.removeItem(key) } catch { /* storage unavailable */ }
}

export const state = {
  rawRecords: [] as BmsRecord[],
  activeFilters: { fwd: [], pol: [], line: [], agent: [] } as FilterState,
  currentMeta: null as Meta | null,
  dateFormat: (safeGet('bms_dateformat') || 'miladi') as 'miladi' | 'jalali',

  // Worker
  worker: null as Worker | null,
  workerBusy: false,
  workerCallback: null as ((data: unknown) => void) | null,
  workerFallback: null as ReturnType<typeof setTimeout> | null,
  workerReady: false,

  // Charts registry
  charts: {} as Record<string, any>,

  // Map
  mapInstance: null as any,
  animId: null as number | null,
  prevPols: null as string | null,
  polResetEl: null as HTMLElement | null,

  // Container list (virtual scroll)
  allRecordsCache: null as import('./types').ContainerRecord[] | null,
  vsFiltered: [] as import('./types').ContainerRecord[],
  vsScrollEl: null as HTMLElement | null,
  vsBodyEl: null as HTMLElement | null,

  // Filter IDs mapping
  filterIds: ['cb-fwd', 'cb-pol', 'cb-line', 'cb-agent'],
  filterProps: ['pol_forwarder', 'pol', 'line', 'iran_agent'],

  // Intervals
  timerInterval: null as ReturnType<typeof setInterval> | null,
  logoutCheckInterval: null as ReturnType<typeof setInterval> | null,
  autoRefreshInterval: null as ReturnType<typeof setInterval> | null,

  // Flags
  fetchInProgress: false,

  // Callbacks
  onLoginSuccess: null as (() => void) | null,
}

// DOM helper
export function $(id: string): HTMLElement | null {
  return document.getElementById(id)
}

// Date format helpers
export function isJalali(): boolean {
  return state.dateFormat === 'jalali'
}
