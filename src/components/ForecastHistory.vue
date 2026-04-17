<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

interface ForecastData {
  front_type: string
  temp_min?: string
  temp_max?: string
}

interface Forecast {
  observed_at: string
  data: ForecastData
}

interface DayHistory {
  target_date: string
  forecasts: Forecast[]
}

const FRONT_TYPE_MAP: Record<string, string> = {
  'Hidegfront':          'cold_front',
  'Melegfront':          'warm_front',
  'Nincs front':         'no_front',
  'Stacionárius front':  'stationary_front',
  'Stacionáris front':   'stationary_front',
  'Kettős front':        'double_front',
}

function normalizeFrontType(raw: string): string {
  return FRONT_TYPE_MAP[raw] ?? raw
}

interface FieldChange {
  field: string
  label: string
  from: string
  to: string
}

function getChanges(prev: Forecast, curr: Forecast): FieldChange[] {
  const changes: FieldChange[] = []
  if (prev.data.front_type !== curr.data.front_type) {
    changes.push({
      field: 'front_type',
      label: 'front',
      from: frontStyle(prev.data.front_type).short,
      to: frontStyle(curr.data.front_type).short,
    })
  }
  const prevMin = prev.data.temp_min
  const currMin = curr.data.temp_min
  if (prevMin !== currMin && (prevMin || currMin)) {
    changes.push({ field: 'temp_min', label: 'T min', from: prevMin ?? '—', to: currMin ?? '—' })
  }
  const prevMax = prev.data.temp_max
  const currMax = curr.data.temp_max
  if (prevMax !== currMax && (prevMax || currMax)) {
    changes.push({ field: 'temp_max', label: 'T max', from: prevMax ?? '—', to: currMax ?? '—' })
  }
  return changes
}

const FRONT_COLORS: Record<string, string> = {
  cold_front:       '#e6f1fb',
  warm_front:       '#fef2f2',
  no_front:         '#f1efe8',
  stationary_front: '#fff7ed',
  double_front:     '#ede9fe',
}

const FRONT_STYLES: Record<string, { pill: string; dot: string; label: string; short: string; card: string }> = {
  cold_front:       { pill: 'front-cold',       dot: 'dot-cold',       label: 'Hidegfront',          short: 'Hidegfront',   card: 'card-cold' },
  warm_front:       { pill: 'front-warm',       dot: 'dot-warm',       label: 'Melegfront',          short: 'Melegfront',   card: 'card-warm' },
  no_front:         { pill: 'front-no',         dot: 'dot-no',         label: 'Nincs front',         short: 'Nincs front',  card: 'card-no' },
  stationary_front: { pill: 'front-stationary', dot: 'dot-stationary', label: 'Stacionárius front',  short: 'Stacionárius', card: 'card-stationary' },
  double_front:     { pill: 'front-double',     dot: 'dot-double',     label: 'Kettős front',        short: 'Kettős front', card: 'card-double' },
}


function cardBackground(day: DayHistory) {
  const sameDayForecasts = day.forecasts.filter(f => f.observed_at.slice(0, 10) === day.target_date)
  if (sameDayForecasts.length < 2) return null
  const uniqueTypes = [...new Set(sameDayForecasts.map(f => f.data.front_type))]
  if (uniqueTypes.length < 2) return null
  const colors = uniqueTypes.map(t => FRONT_COLORS[t] || '#f1efe8')
  return `linear-gradient(to right, ${colors[0]}, ${colors[colors.length - 1]})`
}

function frontStyle(ft: string) {
  return FRONT_STYLES[ft] || { pill: 'front-no', dot: 'dot-no', label: ft, short: ft, card: 'card-no' }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
}

function fmtWeekday(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('hu-HU', { weekday: 'long' })
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}


const history = ref<DayHistory[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const expandedDays = ref<Record<string, boolean>>({})

onMounted(async () => {
  try {
    const { data } = await axios.get(`${import.meta.env.VITE_API_BASE}/b/metoffice`)
    const normalized: DayHistory[] = (data.forecast as DayHistory[]).map(day => ({
      ...day,
      target_date: day.target_date.slice(0, 10),
      forecasts: day.forecasts.map(f => ({
        ...f,
        data: {
          ...f.data,
          front_type: normalizeFrontType(f.data.front_type),
        },
      })),
    }))
    history.value = normalized.sort((a, b) => b.target_date.localeCompare(a.target_date))
  } catch (_e) {
    history.value = _sampleHistory
  } finally {
    loading.value = false
  }
})

const _sampleHistory: DayHistory[] = [
  { target_date: '2026-04-16', forecasts: [
    { observed_at: '2026-04-16T06:00:00Z', data: { front_type: 'warm_front', temp_min: '+10 °C', temp_max: '+18 °C' } },
    { observed_at: '2026-04-16T14:00:00Z', data: { front_type: 'cold_front', temp_min: '+7 °C', temp_max: '+14 °C' } },
  ]},
  { target_date: '2026-04-17', forecasts: [
    { observed_at: '2026-04-15T08:00:00Z', data: { front_type: 'cold_front', temp_min: '+5 °C', temp_max: '+12 °C' } },
    { observed_at: '2026-04-16T08:00:00Z', data: { front_type: 'stationary_front', temp_min: '+6 °C', temp_max: '+13 °C' } },
    { observed_at: '2026-04-17T06:00:00Z', data: { front_type: 'cold_front', temp_min: '+4 °C', temp_max: '+11 °C' } },
    { observed_at: '2026-04-17T16:00:00Z', data: { front_type: 'warm_front', temp_min: '+8 °C', temp_max: '+15 °C' } },
  ]},
  { target_date: '2026-04-18', forecasts: [
    { observed_at: '2026-04-17T08:00:00Z', data: { front_type: 'warm_front', temp_min: '+9 °C', temp_max: '+17 °C' } },
  ]},
  { target_date: '2026-04-19', forecasts: [
    { observed_at: '2026-04-17T08:00:00Z', data: { front_type: 'warm_front', temp_min: '+11 °C', temp_max: '+19 °C' } },
    { observed_at: '2026-04-18T08:00:00Z', data: { front_type: 'no_front', temp_min: '+13 °C', temp_max: '+21 °C' } },
  ]},
  { target_date: '2026-04-20', forecasts: [
    { observed_at: '2026-04-18T08:00:00Z', data: { front_type: 'no_front', temp_min: '+14 °C', temp_max: '+22 °C' } },
    { observed_at: '2026-04-19T08:00:00Z', data: { front_type: 'double_front', temp_min: '+12 °C', temp_max: '+20 °C' } },
    { observed_at: '2026-04-20T06:00:00Z', data: { front_type: 'cold_front', temp_min: '+9 °C', temp_max: '+17 °C' } },
    { observed_at: '2026-04-20T18:00:00Z', data: { front_type: 'cold_front', temp_min: '+7 °C', temp_max: '+15 °C' } },
  ]},
  { target_date: '2026-04-21', forecasts: [
    { observed_at: '2026-04-18T08:00:00Z', data: { front_type: 'warm_front', temp_min: '+12 °C', temp_max: '+21 °C' } },
    { observed_at: '2026-04-19T08:00:00Z', data: { front_type: 'warm_front', temp_min: '+11 °C', temp_max: '+19 °C' } },
    { observed_at: '2026-04-20T08:00:00Z', data: { front_type: 'warm_front', temp_min: '+13 °C', temp_max: '+22 °C' } },
    { observed_at: '2026-04-21T06:00:00Z', data: { front_type: 'cold_front', temp_min: '+6 °C', temp_max: '+13 °C' } },
  ]},
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _oldSample: unknown[] = [
  { target_date: '2026-02-02', forecasts: [
    { observed_at: '2026-02-01T06:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-01T14:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-02-03', forecasts: [
    { observed_at: '2026-02-01T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-02T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-02T20:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-03T08:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-02-04', forecasts: [
    { observed_at: '2026-02-03T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-04T06:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-02-05', forecasts: [{ observed_at: '2026-02-04T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-02-06', forecasts: [{ observed_at: '2026-02-05T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-02-07', forecasts: [
    { observed_at: '2026-02-05T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-02-06T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-06T16:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-02-07T06:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-02-08', forecasts: [
    { observed_at: '2026-02-07T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-08T06:00:00Z', front_type: 'no_front' },
  ]},
  { target_date: '2026-02-09', forecasts: [{ observed_at: '2026-02-08T08:00:00Z', front_type: 'no_front' }] },
  { target_date: '2026-02-10', forecasts: [
    { observed_at: '2026-02-08T08:00:00Z', front_type: 'no_front' },
    { observed_at: '2026-02-09T08:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-02-11', forecasts: [{ observed_at: '2026-02-10T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-02-12', forecasts: [
    { observed_at: '2026-02-10T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-11T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-11T20:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-12T06:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-12T14:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-02-13', forecasts: [{ observed_at: '2026-02-12T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-02-14', forecasts: [
    { observed_at: '2026-02-12T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-13T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-02-14T06:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-14T18:00:00Z', front_type: 'stationary_front' },
  ]},
  { target_date: '2026-02-15', forecasts: [{ observed_at: '2026-02-14T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-02-16', forecasts: [{ observed_at: '2026-02-15T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-02-17', forecasts: [
    { observed_at: '2026-02-15T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-02-16T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-17T06:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-02-17T14:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-02-18', forecasts: [{ observed_at: '2026-02-17T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-02-19', forecasts: [
    { observed_at: '2026-02-17T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-18T08:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-02-20', forecasts: [
    { observed_at: '2026-02-18T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-19T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-20T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-20T16:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-02-21', forecasts: [{ observed_at: '2026-02-20T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-02-22', forecasts: [{ observed_at: '2026-02-21T08:00:00Z', front_type: 'no_front' }] },
  { target_date: '2026-02-23', forecasts: [{ observed_at: '2026-02-22T08:00:00Z', front_type: 'no_front' }] },
  { target_date: '2026-02-24', forecasts: [
    { observed_at: '2026-02-22T08:00:00Z', front_type: 'no_front' },
    { observed_at: '2026-02-23T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-24T06:00:00Z', front_type: 'no_front' },
    { observed_at: '2026-02-24T14:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-02-25', forecasts: [{ observed_at: '2026-02-24T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-02-26', forecasts: [
    { observed_at: '2026-02-24T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-25T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-26T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-02-26T18:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-02-27', forecasts: [{ observed_at: '2026-02-26T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-02-28', forecasts: [{ observed_at: '2026-02-27T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-01', forecasts: [
    { observed_at: '2026-02-27T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-02-28T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-03-01T06:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-01T14:00:00Z', front_type: 'stationary_front' },
  ]},
  { target_date: '2026-03-02', forecasts: [{ observed_at: '2026-03-01T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-03-03', forecasts: [{ observed_at: '2026-03-02T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-03-04', forecasts: [
    { observed_at: '2026-03-02T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-03-03T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-04T06:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-03-04T16:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-03-05', forecasts: [{ observed_at: '2026-03-04T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-03-06', forecasts: [
    { observed_at: '2026-03-04T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-05T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-06T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-06T14:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-03-07', forecasts: [{ observed_at: '2026-03-06T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-08', forecasts: [{ observed_at: '2026-03-07T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-09', forecasts: [{ observed_at: '2026-03-08T08:00:00Z', front_type: 'no_front' }] },
  { target_date: '2026-03-10', forecasts: [
    { observed_at: '2026-03-08T08:00:00Z', front_type: 'no_front' },
    { observed_at: '2026-03-09T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-10T06:00:00Z', front_type: 'no_front' },
    { observed_at: '2026-03-10T14:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-03-11', forecasts: [{ observed_at: '2026-03-10T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-12', forecasts: [
    { observed_at: '2026-03-10T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-11T08:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-03-13', forecasts: [
    { observed_at: '2026-03-11T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-12T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-13T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-13T16:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-03-14', forecasts: [{ observed_at: '2026-03-13T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-15', forecasts: [{ observed_at: '2026-03-14T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-03-16', forecasts: [{ observed_at: '2026-03-15T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-03-17', forecasts: [
    { observed_at: '2026-03-15T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-03-16T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-17T06:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-03-17T18:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-03-18', forecasts: [{ observed_at: '2026-03-17T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-03-19', forecasts: [
    { observed_at: '2026-03-17T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-18T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-19T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-19T14:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-03-20', forecasts: [{ observed_at: '2026-03-19T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-21', forecasts: [{ observed_at: '2026-03-20T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-22', forecasts: [{ observed_at: '2026-03-21T08:00:00Z', front_type: 'no_front' }] },
  { target_date: '2026-03-23', forecasts: [
    { observed_at: '2026-03-21T08:00:00Z', front_type: 'no_front' },
    { observed_at: '2026-03-22T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-23T06:00:00Z', front_type: 'no_front' },
    { observed_at: '2026-03-23T16:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-03-24', forecasts: [{ observed_at: '2026-03-23T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-03-25', forecasts: [{ observed_at: '2026-03-24T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-03-26', forecasts: [
    { observed_at: '2026-03-24T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-25T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-26T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-26T14:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-03-27', forecasts: [{ observed_at: '2026-03-26T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-28', forecasts: [{ observed_at: '2026-03-27T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-03-29', forecasts: [
    { observed_at: '2026-03-27T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-03-28T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-29T06:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-03-29T18:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-03-30', forecasts: [{ observed_at: '2026-03-29T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-03-31', forecasts: [
    { observed_at: '2026-03-29T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-30T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-03-31T06:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-03-31T14:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-04-01', forecasts: [{ observed_at: '2026-03-31T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-04-02', forecasts: [{ observed_at: '2026-04-01T08:00:00Z', front_type: 'warm_front' }] },
  { target_date: '2026-04-03', forecasts: [
    { observed_at: '2026-04-01T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-04-02T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-04-03T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-04-03T16:00:00Z', front_type: 'cold_front' },
  ]},
  { target_date: '2026-04-04', forecasts: [{ observed_at: '2026-04-03T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-04-05', forecasts: [{ observed_at: '2026-04-04T08:00:00Z', front_type: 'no_front' }] },
  { target_date: '2026-04-06', forecasts: [{ observed_at: '2026-04-05T08:00:00Z', front_type: 'cold_front' }] },
  { target_date: '2026-04-07', forecasts: [
    { observed_at: '2026-04-05T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-04-06T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-04-07T06:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-04-07T14:00:00Z', front_type: 'stationary_front' },
  ]},
  { target_date: '2026-04-08', forecasts: [{ observed_at: '2026-04-07T08:00:00Z', front_type: 'stationary_front' }] },
  { target_date: '2026-04-09', forecasts: [
    { observed_at: '2026-04-07T08:00:00Z', front_type: 'stationary_front' },
    { observed_at: '2026-04-08T08:00:00Z', front_type: 'warm_front' },
  ]},
  { target_date: '2026-04-10', forecasts: [
    { observed_at: '2026-04-08T08:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-04-09T08:00:00Z', front_type: 'cold_front' },
    { observed_at: '2026-04-10T06:00:00Z', front_type: 'warm_front' },
    { observed_at: '2026-04-10T18:00:00Z', front_type: 'cold_front' },
  ]},
]

const days = computed(() => history.value.map(day => {
  const latest = day.forecasts[day.forecasts.length - 1]
  const style = frontStyle(latest.data.front_type)
  const latestWithTemp = [...day.forecasts].reverse().find(f => f.data.temp_min && f.data.temp_max)
  const temp_min = latestWithTemp?.data.temp_min
  const temp_max = latestWithTemp?.data.temp_max
  const bg = cardBackground(day)
  const hasOnDayChanges = day.forecasts.length >= 2
  const onDayList = day.forecasts
  const entriesWithChanges = onDayList
    .map((entry, i) => ({
      ...entry,
      changes: i > 0 ? getChanges(onDayList[i - 1], entry) : [] as FieldChange[],
    }))
    .filter(e => e.changes.length > 0)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const isToday = day.target_date === today.toLocaleDateString('en-CA')
  const isTomorrow = day.target_date === tomorrow.toLocaleDateString('en-CA')
  const isYesterday = day.target_date === yesterday.toLocaleDateString('en-CA')
  return { ...day, latest, style, bg, hasOnDayChanges, isToday, isTomorrow, isYesterday, temp_min, temp_max, entriesWithChanges }
}))

function onDayEntries(day: DayHistory) {
  return day.forecasts.filter(f => f.observed_at.slice(0, 10) >= day.target_date)
}

function toggleDay(targetDate: string) {
  expandedDays.value[targetDate] = !expandedDays.value[targetDate]
}
</script>

<template>
  <div class="forecast-history">
    <div v-if="loading" class="state-msg">Loading…</div>
    <div v-else-if="error" class="state-msg state-error">{{ error }}</div>
    <div
      v-for="day in days"
      :key="day.target_date"
      class="day-card"
      :class="[day.bg ? 'day-card--gradient' : day.style.card, { 'day-card--today': day.isToday, 'day-card--tomorrow': day.isTomorrow, 'day-card--has-history': day.hasOnDayChanges }]"
      :style="day.bg ? { background: day.bg } : {}"
    >
      <div class="card-body" :class="{ 'no-history': !day.hasOnDayChanges }">
        <div class="card-left" :class="{ 'card-left--expandable': day.hasOnDayChanges, 'card-left--open': expandedDays[day.target_date] }" @click="day.hasOnDayChanges && toggleDay(day.target_date)">
          <div class="card-date-block">
            <div class="card-title-row">
              <span v-if="day.isYesterday" class="yesterday-badge">Tegnap</span>
              <span v-else-if="day.isToday" class="today-badge">Ma</span>
              <span v-else-if="day.isTomorrow" class="tomorrow-badge">Holnap</span>
              <span v-else class="day-weekday">{{ fmtWeekday(day.target_date) }}</span>
            </div>
            <span class="day-date">{{ fmtShortDate(day.target_date) }}</span>
          </div>
          <span class="front-pill" :class="day.bg ? 'front-mixed' : day.style.pill">{{ day.style.label }}</span>
          <div v-if="day.temp_min && day.temp_max" class="weather-col">
            <span class="weather-temp">{{ day.temp_min }} / {{ day.temp_max }}</span>
          </div>
        </div>
        <div v-if="day.hasOnDayChanges" class="card-right" :class="{ 'card-right--collapsed': !expandedDays[day.target_date] }">
          <div class="timeline">
            <template v-for="(entry, i) in day.entriesWithChanges" :key="i">
              <div class="timeline-row">
                <div class="dot" :class="frontStyle(entry.data.front_type).dot"></div>
                <span class="tl-time">{{ fmt(entry.observed_at) }}</span>
                <span v-if="entry.changes.length > 0" class="tl-inline-changes">
                  <span v-for="(change, ci) in entry.changes" :key="change.field">
                    <span v-if="ci > 0" class="tl-sep"> · </span>
                    <span class="tl-from">{{ change.from }}</span>
                    <span class="tl-arrow"> → </span>
                    <span class="tl-to">{{ change.to }}</span>
                  </span>
                </span>
              </div>
              <div v-if="i < day.entriesWithChanges.length - 1" class="timeline-connector">
                <div class="connector-wrap">
                  <div class="connector-line"></div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forecast-history {
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.state-msg {
  text-align: center;
  padding: 2rem;
  color: #888;
  font-size: 14px;
}

.state-error {
  color: #991b1b;
}

.day-card {
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.day-card--today {
  border: 2px solid #44403c;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
.day-card--gradient.day-card--today {
  border: 2px solid rgba(0, 0, 0, 0.2);
}

.day-card--tomorrow {
  border: 1.5px solid rgba(0, 0, 0, 0.3);
}

.today-badge {
  font-size: 22px;
  font-weight: 600;
  background: #44403c;
  color: #fff;
  padding: 4px 12px;
  border-radius: 20px;
}

.tomorrow-badge {
  font-size: 22px;
  font-weight: 500;
  background: transparent;
  color: #888;
  border: 1px solid #ccc;
  padding: 4px 12px;
  border-radius: 20px;
}

.yesterday-badge {
  font-size: 22px;
  font-weight: 600;
  color: #44403c;
}

.card-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.card-body.no-history {
  grid-template-columns: 1fr;
}

.card-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
}

.card-date-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
  width: 120px;
}

.card-right {
  border-left: 0.5px solid rgba(0, 0, 0, 0.08);
  padding-left: 12px;
}

@media (max-width: 768px) {
  .card-body {
    grid-template-columns: 1fr;
  }
  .card-right {
    border-left: none;
    border-top: 0.5px solid rgba(0, 0, 0, 0.08);
    padding-left: 0;
    padding-top: 10px;
  }
  .card-right--collapsed {
    display: none;
  }
  .day-card--has-history {
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
  }
  .card-left--expandable {
    cursor: pointer;
    user-select: none;
  }
  .forecast-history {
    padding: 0;
  }
  .card-left {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 4px 12px;
    align-items: center;
  }
  .card-date-block {
    display: contents;
  }
  .card-title-row {
    grid-column: 1;
    grid-row: 1;
    align-self: center;
  }
  .day-date {
    grid-column: 1;
    grid-row: 2;
    align-self: center;
  }
  .card-left > .front-pill {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
  }
  .weather-col {
    grid-column: 2;
    grid-row: 2;
    align-self: center;
  }
}

@media (min-width: 769px) {
  .day-weekday { font-size: 16px !important; }
  .day-date { font-size: 13px !important; }
  .front-pill { font-size: 14px !important; padding: 6px 14px !important; }
  .today-badge, .tomorrow-badge { font-size: 13px !important; padding: 3px 10px !important; }
  .yesterday-badge { font-size: 16px !important; }
  .weather-temp { font-size: 14px !important; padding-left: 14px !important; }
  .weather-temp { font-size: 18px; }
  .weather-wind { font-size: 16px; }
}

.card-cold       { background: #e6f1fb; border-color: #b5d4f4; }
.card-warm       { background: #fef2f2; border-color: #fca5a5; }
.card-no         { background: #f1efe8; border-color: #d3d1c7; }
.card-stationary { background: #fff7ed; border-color: #fdba74; }
.card-double     { background: #ede9fe; border-color: #c4b5fd; }

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}


.day-weekday {
  font-size: 22px;
  font-weight: 600;
  color: #44403c;
  text-transform: capitalize;
}

.day-date {
  font-size: 17px;
  font-weight: 400;
  color: #999;
}

.front-pill {
  font-size: 22px;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 12px;
  white-space: nowrap;
}

.weather-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  flex-shrink: 0;
}

.weather-temp {
  font-size: 18px;
  font-weight: 600;
  color: #44403c;
  padding-left: 16px;
}

.front-mixed      { background: rgba(255, 255, 255, 0.55); color: #44403c; }
.front-cold       { background: #e6f1fb; color: #0c447c; }
.front-warm       { background: #fef2f2; color: #991b1b; }
.front-no         { background: #f1efe8; color: #444441; }
.front-stationary { background: #fff7ed; color: #9a3412; }
.front-double     { background: #ede9fe; color: #5b21b6; }

.timeline {
  padding-top: 0;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
}

.timeline-connector {
  display: flex;
  align-items: stretch;
  gap: 10px;
  height: 6px;
}

.connector-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 13px;
  flex-shrink: 0;
}

.connector-line {
  width: 1px;
  height: 100%;
  background: rgba(0, 0, 0, 0.15);
}

.dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid;
}

.dot-cold       { background: #b5d4f4; border-color: #378add; }
.dot-warm       { background: #fca5a5; border-color: #ef4444; }
.dot-no         { background: #d3d1c7; border-color: #888780; }
.dot-stationary { background: #fdba74; border-color: #f97316; }
.dot-double     { background: #c4b5fd; border-color: #7c3aed; }

.tl-time {
  font-size: 12px;
  color: #888;
  min-width: 90px;
}

.tl-inline-changes {
  font-size: 12px;
}

.tl-from {
  color: #bbb;
}

.tl-arrow {
  color: #ccc;
}

.tl-to {
  color: #44403c;
  font-weight: 500;
}

.tl-sep {
  color: #ddd;
}
</style>
