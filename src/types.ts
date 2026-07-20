/* ============================================================
   BMS Dashboard — Type Definitions
   ============================================================ */

export interface BmsRecord {
  caravan: string | null
  vessel: string | null
  container: string | null
  size: string | null
  qty: number
  pol_forwarder: string | null
  pol: string | null
  line: string | null
  iran_agent: string | null
  arrv_date: Date | null
  date: Date | null
  status: 'Arrived' | 'Pending'
}

export interface AggResult {
  total_containers: number
  total_shipments: number
  total_teu: number
  unique_vessels: number
  unique_lines: number
  unique_forwarders: number
  unique_agents: number
  date_min: string | null
  date_max: string | null
  pending_count: number
  arrived_count: number
  size_dist: LabelValue[]
  top_lines: LabelValue[]
  top_forwarders: LabelValue[]
  top_agents: LabelValue[]
  top_pol: LabelValue[]
  yearly_cont: LabelValue[]
  yearly_ship: LabelValue[]
  monthly_cont: MonthlyData[]
  daily: DailyData[]
  rangeDays: number
  all_records: ContainerRecord[]
  pol_coords: PolCoord[]
  line_share: LabelValue[]
  prevPeriod?: AggResult
  prevPeriodLabel?: string
  curPeriodLabel?: string
}

export interface LabelValue {
  label: string
  value: number
}

export interface MonthlyData {
  month: string
  cont: number
  ship: number
}

export interface DailyData {
  label: string
  cont: number
  ship: number
}

export interface ContainerRecord {
  container: string | null
  vessel: string | null
  size: string | null
  qty: number
  pol_forwarder: string | null
  pol: string | null
  line: string | null
  iran_agent: string | null
  date: string
  status: string
  _search?: string
}

export interface PolCoord {
  name: string
  lat: number
  lng: number
  count: number
}

export interface FilterState {
  fwd: string[]
  pol: string[]
  line: string[]
  agent: string[]
}

export interface Meta {
  filename?: string | null
  time?: string | null
}
