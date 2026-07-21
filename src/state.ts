/* ============================================================
   BMS Dashboard — Centralized State
   ============================================================ */

import type { BmsRecord, FilterState, Meta } from './types'

export const state = {
  rawRecords: [] as BmsRecord[],
  activeFilters: { fwd: [], pol: [], line: [], agent: [] } as FilterState,
  currentMeta: null as Meta | null,
  dateFormat: (localStorage.getItem('bms_dateformat') || 'miladi') as 'miladi' | 'jalali',
  activeDatePreset: null as string | null,

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
}

// DOM helper
export function $(id: string): HTMLElement | null {
  return document.getElementById(id)
}

// Date format helpers
export function isJalali(): boolean {
  return state.dateFormat === 'jalali'
}
