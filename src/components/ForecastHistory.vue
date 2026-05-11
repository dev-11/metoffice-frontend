<script setup lang="ts">
import { ref, computed, watch, onMounted, onUpdated, onUnmounted, nextTick, type Ref } from 'vue'
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
  Hidegfront: 'cold_front',
  Melegfront: 'warm_front',
  'Nincs front': 'no_front',
  'Stacionárius front': 'stationary_front',
  'Stacionáris front': 'stationary_front',
  'Kettős front': 'double_front',
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
  cold_front: '#e6f1fb',
  warm_front: '#fef2f2',
  no_front: '#f1efe8',
  stationary_front: '#fff7ed',
  double_front: '#ede9fe',
}

const FRONT_COLORS_DARK: Record<string, string> = {
  cold_front: '#1a2e42',
  warm_front: '#2d1a1a',
  no_front: '#252220',
  stationary_front: '#2e1e0a',
  double_front: '#211a38',
}

const FRONT_STYLES: Record<
  string,
  { pill: string; dot: string; label: string; short: string; card: string }
> = {
  cold_front: {
    pill: 'front-cold',
    dot: 'dot-cold',
    label: 'Hidegfront',
    short: 'Hidegfront',
    card: 'card-cold',
  },
  warm_front: {
    pill: 'front-warm',
    dot: 'dot-warm',
    label: 'Melegfront',
    short: 'Melegfront',
    card: 'card-warm',
  },
  no_front: {
    pill: 'front-no',
    dot: 'dot-no',
    label: 'Nincs front',
    short: 'Nincs front',
    card: 'card-no',
  },
  stationary_front: {
    pill: 'front-stationary',
    dot: 'dot-stationary',
    label: 'Stacionárius front',
    short: 'Stacionárius',
    card: 'card-stationary',
  },
  double_front: {
    pill: 'front-double',
    dot: 'dot-double',
    label: 'Kettős front',
    short: 'Kettős front',
    card: 'card-double',
  },
}

function cardBackground(day: DayHistory) {
  const sameDayForecasts = day.forecasts.filter(
    (f) => f.observed_at.slice(0, 10) === day.target_date,
  )
  if (sameDayForecasts.length < 2) return null
  const uniqueTypes = [...new Set(sameDayForecasts.map((f) => f.data.front_type))]
  if (uniqueTypes.length < 2) return null
  const palette = isDarkMode.value ? FRONT_COLORS_DARK : FRONT_COLORS
  const fallback = isDarkMode.value ? '#252220' : '#f1efe8'
  const colors = uniqueTypes.map((t) => palette[t] || fallback)
  return `linear-gradient(to right, ${colors[0]}, ${colors[colors.length - 1]})`
}

function frontStyle(ft: string) {
  return (
    FRONT_STYLES[ft] || { pill: 'front-no', dot: 'dot-no', label: ft, short: ft, card: 'card-no' }
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })
}

function fmtWeekday(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('hu-HU', { weekday: 'long' })
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const history = ref<DayHistory[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const LOADING_EMOJIS = ['☀️', '🌤️', '⛅', '🌥️', '🌦️', '🌧️', '⛈️', '🌨️', '❄️', '🌬️', '🌈']
const LOADING_TEXTS = [
  'Licking a finger and holding it up…',
  'Bribing a seagull for info…',
  'Asking the barometer nicely…',
  'Checking if cows are sitting…',
  'Consulting the clouds…',
  'Counting raindrops…',
  'Interrogating a groundhog…',
  'Waiting for the fog to lift…',
  'Reading the frost patterns…',
  'Watching which way the smoke goes…',
  'Almost there, probably…',
]
const loadingEmojiIdx = ref(0)
const loadingOrder = ref<number[]>([])

function shuffleLoadingOrder() {
  const indices = Array.from({ length: LOADING_EMOJIS.length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices
}

let _loadingInterval: ReturnType<typeof setInterval> | null = null
watch(loading, (isLoading) => {
  if (isLoading) {
    loadingOrder.value = shuffleLoadingOrder()
    loadingEmojiIdx.value = 0
    _loadingInterval = setInterval(() => {
      loadingEmojiIdx.value = (loadingEmojiIdx.value + 1) % LOADING_EMOJIS.length
    }, 2200)
  } else {
    if (_loadingInterval) { clearInterval(_loadingInterval); _loadingInterval = null }
  }
}, { immediate: true })
const expandedDays = ref<Record<string, boolean>>({})

onMounted(async () => {
  try {
    const { data } = await axios.get(`${import.meta.env.VITE_API_BASE}/b/metoffice`)
    const normalized: DayHistory[] = (data.forecast as DayHistory[]).map((day) => ({
      ...day,
      target_date: day.target_date.slice(0, 10),
      forecasts: day.forecasts.map((f) => ({
        ...f,
        data: {
          ...f.data,
          front_type: normalizeFrontType(f.data.front_type),
        },
      })),
    }))
    history.value = normalized.sort((a, b) => b.target_date.localeCompare(a.target_date))
  } catch (_e) {
    const fixedOld: DayHistory[] = (_oldSample as any[]).map((day) => ({
      target_date: day.target_date,
      forecasts: day.forecasts.map((f: any) => ({
        observed_at: f.observed_at,
        data: { front_type: f.front_type, temp_min: f.temp_min, temp_max: f.temp_max },
      })),
    }))
    history.value = [..._sampleHistory, ...fixedOld].sort((a, b) =>
      b.target_date.localeCompare(a.target_date),
    )
  } finally {
    loading.value = false
  }
})

const _sampleHistory: DayHistory[] = [
  {
    target_date: '2026-05-12',
    forecasts: [
      {
        observed_at: '2026-05-10T08:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+13 °C', temp_max: '+22 °C' },
      },
      {
        observed_at: '2026-05-11T08:00:00Z',
        data: { front_type: 'no_front', temp_min: '+14 °C', temp_max: '+23 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-11',
    forecasts: [
      {
        observed_at: '2026-05-09T08:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+8 °C', temp_max: '+16 °C' },
      },
      {
        observed_at: '2026-05-10T08:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+11 °C', temp_max: '+19 °C' },
      },
      {
        observed_at: '2026-05-11T06:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+12 °C', temp_max: '+20 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-10',
    forecasts: [
      {
        observed_at: '2026-05-09T08:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+6 °C', temp_max: '+14 °C' },
      },
      {
        observed_at: '2026-05-10T08:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+7 °C', temp_max: '+15 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-09',
    forecasts: [
      {
        observed_at: '2026-05-08T08:00:00Z',
        data: { front_type: 'stationary_front', temp_min: '+9 °C', temp_max: '+17 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-02',
    forecasts: [
      {
        observed_at: '2026-05-02T06:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+10 °C', temp_max: '+18 °C' },
      },
      {
        observed_at: '2026-05-02T14:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+7 °C', temp_max: '+14 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-03',
    forecasts: [
      {
        observed_at: '2026-05-01T08:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+5 °C', temp_max: '+12 °C' },
      },
      {
        observed_at: '2026-05-02T08:00:00Z',
        data: { front_type: 'stationary_front', temp_min: '+6 °C', temp_max: '+13 °C' },
      },
      {
        observed_at: '2026-05-03T06:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+4 °C', temp_max: '+11 °C' },
      },
      {
        observed_at: '2026-05-03T16:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+8 °C', temp_max: '+15 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-04',
    forecasts: [
      {
        observed_at: '2026-05-03T08:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+9 °C', temp_max: '+17 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-05',
    forecasts: [
      {
        observed_at: '2026-05-03T08:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+11 °C', temp_max: '+19 °C' },
      },
      {
        observed_at: '2026-05-04T08:00:00Z',
        data: { front_type: 'no_front', temp_min: '+13 °C', temp_max: '+21 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-06',
    forecasts: [
      {
        observed_at: '2026-05-04T08:00:00Z',
        data: { front_type: 'no_front', temp_min: '+14 °C', temp_max: '+22 °C' },
      },
      {
        observed_at: '2026-05-05T08:00:00Z',
        data: { front_type: 'double_front', temp_min: '+12 °C', temp_max: '+20 °C' },
      },
      {
        observed_at: '2026-05-06T06:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+9 °C', temp_max: '+17 °C' },
      },
      {
        observed_at: '2026-05-06T18:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+7 °C', temp_max: '+15 °C' },
      },
    ],
  },
  {
    target_date: '2026-05-07',
    forecasts: [
      {
        observed_at: '2026-05-04T08:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+12 °C', temp_max: '+21 °C' },
      },
      {
        observed_at: '2026-05-05T08:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+11 °C', temp_max: '+19 °C' },
      },
      {
        observed_at: '2026-05-06T08:00:00Z',
        data: { front_type: 'warm_front', temp_min: '+13 °C', temp_max: '+22 °C' },
      },
      {
        observed_at: '2026-05-07T06:00:00Z',
        data: { front_type: 'cold_front', temp_min: '+6 °C', temp_max: '+13 °C' },
      },
    ],
  },
]

const _oldSample: unknown[] = [
  {
    target_date: '2026-02-02',
    forecasts: [
      {
        observed_at: '2026-02-01T06:00:00Z',
        front_type: 'cold_front',
        temp_min: '+1 °C',
        temp_max: '+6 °C',
      },
      {
        observed_at: '2026-02-01T14:00:00Z',
        front_type: 'warm_front',
        temp_min: '+1 °C',
        temp_max: '+6 °C',
      },
    ],
  },
  {
    target_date: '2026-02-03',
    forecasts: [
      {
        observed_at: '2026-02-01T08:00:00Z',
        front_type: 'warm_front',
        temp_min: '+2 °C',
        temp_max: '+8 °C',
      },
      {
        observed_at: '2026-02-02T08:00:00Z',
        front_type: 'cold_front',
        temp_min: '+2 °C',
        temp_max: '+8 °C',
      },
      {
        observed_at: '2026-02-02T20:00:00Z',
        front_type: 'warm_front',
        temp_min: '+2 °C',
        temp_max: '+8 °C',
      },
      {
        observed_at: '2026-02-03T08:00:00Z',
        front_type: 'cold_front',
        temp_min: '+2 °C',
        temp_max: '+8 °C',
      },
    ],
  },
  {
    target_date: '2026-02-04',
    forecasts: [
      {
        observed_at: '2026-02-03T08:00:00Z',
        front_type: 'cold_front',
        temp_min: '0 °C',
        temp_max: '+5 °C',
      },
      {
        observed_at: '2026-02-04T06:00:00Z',
        front_type: 'warm_front',
        temp_min: '0 °C',
        temp_max: '+5 °C',
      },
    ],
  },
  {
    target_date: '2026-02-05',
    forecasts: [
      {
        observed_at: '2026-02-04T08:00:00Z',
        front_type: 'stationary_front',
        temp_min: '+3 °C',
        temp_max: '+9 °C',
      },
    ],
  },
  {
    target_date: '2026-02-06',
    forecasts: [
      {
        observed_at: '2026-02-05T08:00:00Z',
        front_type: 'stationary_front',
        temp_min: '+4 °C',
        temp_max: '+11 °C',
      },
    ],
  },
  {
    target_date: '2026-02-07',
    forecasts: [
      { observed_at: '2026-02-05T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-02-06T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-06T16:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-02-07T06:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-02-08',
    forecasts: [
      { observed_at: '2026-02-07T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-08T06:00:00Z', front_type: 'no_front' },
    ],
  },
  {
    target_date: '2026-02-09',
    forecasts: [{ observed_at: '2026-02-08T08:00:00Z', front_type: 'no_front' }],
  },
  {
    target_date: '2026-02-10',
    forecasts: [
      { observed_at: '2026-02-08T08:00:00Z', front_type: 'no_front' },
      { observed_at: '2026-02-09T08:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-02-11',
    forecasts: [{ observed_at: '2026-02-10T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-02-12',
    forecasts: [
      { observed_at: '2026-02-10T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-02-11T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-11T20:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-02-12T06:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-12T14:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-02-13',
    forecasts: [{ observed_at: '2026-02-12T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-02-14',
    forecasts: [
      { observed_at: '2026-02-12T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-13T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-02-14T06:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-14T18:00:00Z', front_type: 'stationary_front' },
    ],
  },
  {
    target_date: '2026-02-15',
    forecasts: [{ observed_at: '2026-02-14T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-02-16',
    forecasts: [{ observed_at: '2026-02-15T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-02-17',
    forecasts: [
      { observed_at: '2026-02-15T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-02-16T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-17T06:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-02-17T14:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-02-18',
    forecasts: [{ observed_at: '2026-02-17T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-02-19',
    forecasts: [
      { observed_at: '2026-02-17T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-18T08:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-02-20',
    forecasts: [
      { observed_at: '2026-02-18T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-02-19T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-20T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-02-20T16:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-02-21',
    forecasts: [{ observed_at: '2026-02-20T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-02-22',
    forecasts: [{ observed_at: '2026-02-21T08:00:00Z', front_type: 'no_front' }],
  },
  {
    target_date: '2026-02-23',
    forecasts: [{ observed_at: '2026-02-22T08:00:00Z', front_type: 'no_front' }],
  },
  {
    target_date: '2026-02-24',
    forecasts: [
      { observed_at: '2026-02-22T08:00:00Z', front_type: 'no_front' },
      { observed_at: '2026-02-23T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-02-24T06:00:00Z', front_type: 'no_front' },
      { observed_at: '2026-02-24T14:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-02-25',
    forecasts: [{ observed_at: '2026-02-24T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-02-26',
    forecasts: [
      { observed_at: '2026-02-24T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-02-25T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-26T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-02-26T18:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-02-27',
    forecasts: [{ observed_at: '2026-02-26T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-02-28',
    forecasts: [{ observed_at: '2026-02-27T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-01',
    forecasts: [
      { observed_at: '2026-02-27T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-02-28T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-03-01T06:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-01T14:00:00Z', front_type: 'stationary_front' },
    ],
  },
  {
    target_date: '2026-03-02',
    forecasts: [{ observed_at: '2026-03-01T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-03-03',
    forecasts: [{ observed_at: '2026-03-02T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-03-04',
    forecasts: [
      { observed_at: '2026-03-02T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-03-03T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-04T06:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-03-04T16:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-03-05',
    forecasts: [{ observed_at: '2026-03-04T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-03-06',
    forecasts: [
      { observed_at: '2026-03-04T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-05T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-06T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-06T14:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-03-07',
    forecasts: [{ observed_at: '2026-03-06T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-08',
    forecasts: [{ observed_at: '2026-03-07T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-09',
    forecasts: [{ observed_at: '2026-03-08T08:00:00Z', front_type: 'no_front' }],
  },
  {
    target_date: '2026-03-10',
    forecasts: [
      { observed_at: '2026-03-08T08:00:00Z', front_type: 'no_front' },
      { observed_at: '2026-03-09T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-10T06:00:00Z', front_type: 'no_front' },
      { observed_at: '2026-03-10T14:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-03-11',
    forecasts: [{ observed_at: '2026-03-10T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-12',
    forecasts: [
      { observed_at: '2026-03-10T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-11T08:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-03-13',
    forecasts: [
      { observed_at: '2026-03-11T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-12T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-13T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-13T16:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-03-14',
    forecasts: [{ observed_at: '2026-03-13T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-15',
    forecasts: [{ observed_at: '2026-03-14T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-03-16',
    forecasts: [{ observed_at: '2026-03-15T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-03-17',
    forecasts: [
      { observed_at: '2026-03-15T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-03-16T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-17T06:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-03-17T18:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-03-18',
    forecasts: [{ observed_at: '2026-03-17T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-03-19',
    forecasts: [
      { observed_at: '2026-03-17T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-18T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-19T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-19T14:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-03-20',
    forecasts: [{ observed_at: '2026-03-19T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-21',
    forecasts: [{ observed_at: '2026-03-20T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-22',
    forecasts: [{ observed_at: '2026-03-21T08:00:00Z', front_type: 'no_front' }],
  },
  {
    target_date: '2026-03-23',
    forecasts: [
      { observed_at: '2026-03-21T08:00:00Z', front_type: 'no_front' },
      { observed_at: '2026-03-22T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-23T06:00:00Z', front_type: 'no_front' },
      { observed_at: '2026-03-23T16:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-03-24',
    forecasts: [{ observed_at: '2026-03-23T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-03-25',
    forecasts: [{ observed_at: '2026-03-24T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-03-26',
    forecasts: [
      { observed_at: '2026-03-24T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-25T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-26T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-26T14:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-03-27',
    forecasts: [{ observed_at: '2026-03-26T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-28',
    forecasts: [{ observed_at: '2026-03-27T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-03-29',
    forecasts: [
      { observed_at: '2026-03-27T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-03-28T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-29T06:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-03-29T18:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-03-30',
    forecasts: [{ observed_at: '2026-03-29T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-03-31',
    forecasts: [
      { observed_at: '2026-03-29T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-30T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-03-31T06:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-03-31T14:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-04-01',
    forecasts: [{ observed_at: '2026-03-31T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-04-02',
    forecasts: [{ observed_at: '2026-04-01T08:00:00Z', front_type: 'warm_front' }],
  },
  {
    target_date: '2026-04-03',
    forecasts: [
      { observed_at: '2026-04-01T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-04-02T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-04-03T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-04-03T16:00:00Z', front_type: 'cold_front' },
    ],
  },
  {
    target_date: '2026-04-04',
    forecasts: [{ observed_at: '2026-04-03T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-04-05',
    forecasts: [{ observed_at: '2026-04-04T08:00:00Z', front_type: 'no_front' }],
  },
  {
    target_date: '2026-04-06',
    forecasts: [{ observed_at: '2026-04-05T08:00:00Z', front_type: 'cold_front' }],
  },
  {
    target_date: '2026-04-07',
    forecasts: [
      { observed_at: '2026-04-05T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-04-06T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-04-07T06:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-04-07T14:00:00Z', front_type: 'stationary_front' },
    ],
  },
  {
    target_date: '2026-04-08',
    forecasts: [{ observed_at: '2026-04-07T08:00:00Z', front_type: 'stationary_front' }],
  },
  {
    target_date: '2026-04-09',
    forecasts: [
      { observed_at: '2026-04-07T08:00:00Z', front_type: 'stationary_front' },
      { observed_at: '2026-04-08T08:00:00Z', front_type: 'warm_front' },
    ],
  },
  {
    target_date: '2026-04-10',
    forecasts: [
      { observed_at: '2026-04-08T08:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-04-09T08:00:00Z', front_type: 'cold_front' },
      { observed_at: '2026-04-10T06:00:00Z', front_type: 'warm_front' },
      { observed_at: '2026-04-10T18:00:00Z', front_type: 'cold_front' },
    ],
  },
]

const days = computed(() =>
  history.value.map((day) => {
    const latest = day.forecasts[day.forecasts.length - 1]
    const style = frontStyle(latest.data.front_type)
    const latestWithTemp = [...day.forecasts]
      .reverse()
      .find((f) => f.data.temp_min && f.data.temp_max)
    const temp_min = latestWithTemp?.data.temp_min
    const temp_max = latestWithTemp?.data.temp_max
    const bg = cardBackground(day)
    const hasOnDayChanges = day.forecasts.length >= 2
    const onDayList = day.forecasts
    const entriesWithChanges = onDayList
      .map((entry, i) => ({
        ...entry,
        changes: i > 0 ? getChanges(onDayList[i - 1], entry) : ([] as FieldChange[]),
      }))
      .filter((e) => e.changes.length > 0)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const dayBeforeYesterday = new Date(today)
    dayBeforeYesterday.setDate(today.getDate() - 2)
    const isToday = day.target_date === today.toLocaleDateString('en-CA')
    const isTomorrow = day.target_date === tomorrow.toLocaleDateString('en-CA')
    const isYesterday = day.target_date === yesterday.toLocaleDateString('en-CA')
    const isDayBeforeYesterday = day.target_date === dayBeforeYesterday.toLocaleDateString('en-CA')
    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() - 2) // tegnapelőtt and newer → cards; older → calendar
    const isOld = day.target_date < cutoff.toLocaleDateString('en-CA') // string compare avoids UTC timezone shift
    return {
      ...day,
      latest,
      style,
      bg,
      hasOnDayChanges,
      isToday,
      isTomorrow,
      isYesterday,
      isDayBeforeYesterday,
      isOld,
      temp_min,
      temp_max,
      entriesWithChanges,
    }
  }),
)

function onDayEntries(day: DayHistory) {
  return day.forecasts.filter((f) => f.observed_at.slice(0, 10) >= day.target_date)
}

function toggleDay(targetDate: string) {
  expandedDays.value[targetDate] = !expandedDays.value[targetDate]
}

// ── Calendar cell popover ──
const selectedCalDate = ref<string | null>(null)
const calPopoverPos = ref({ top: 0, left: 0, width: 0 })

const selectedCalDay = computed(() =>
  selectedCalDate.value
    ? (days.value.find((d) => d.target_date === selectedCalDate.value) ?? null)
    : null,
)

function openCalPopover(event: MouseEvent, dateStr: string) {
  if (selectedCalDate.value === dateStr) {
    selectedCalDate.value = null
    return
  }
  const cellRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const calRect = (event.currentTarget as HTMLElement)
    .closest('.cal-month')!
    .getBoundingClientRect()
  const minWidth = isDesktop.value ? 320 : calRect.width
  const popoverWidth = Math.max(calRect.width, minWidth)
  const left = Math.min(calRect.left, window.innerWidth - popoverWidth - 8)
  calPopoverPos.value = {
    top: cellRect.bottom + 8,
    left: Math.max(8, left),
    width: popoverWidth,
  }
  selectedCalDate.value = dateStr
}

function closeCalPopover() {
  selectedCalDate.value = null
}

// Hide cal temp labels that are wider than their cell (or show them if they fit).
// Called after Vue updates (data load, HMR) and on window resize.
function checkTempWidths() {
  requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>('.cal-temp-area').forEach((area) => {
      area.style.display = '' // reset first (viewport may have grown)
      if (area.clientWidth === 0) return // CSS breakpoint is hiding it
      const span = area.querySelector<HTMLElement>('.cal-temp')
      if (!span) return
      if (span.scrollWidth > area.clientWidth) {
        area.style.display = 'none'
      }
    })
  })
}

onUpdated(() => {
  checkTempWidths()
})

let _mq: MediaQueryList | null = null
let _mqHandler: ((e: MediaQueryListEvent) => void) | null = null
let _dmq: MediaQueryList | null = null
let _dmqHandler: ((e: MediaQueryListEvent) => void) | null = null

onMounted(() => {
  // Belt-and-suspenders: also apply body class in onMounted in case watch+immediate
  // didn't fire (e.g. HMR restore) — keeps teleported popover styled correctly
  document.body.classList.toggle('is-dark', isDarkMode.value)
  console.log('[ForecastHistory] isDarkMode:', isDarkMode.value, '— body.is-dark:', document.body.classList.contains('is-dark'))

  window.addEventListener('resize', checkTempWidths)
  window.addEventListener('resize', updateSlideHeight)
  _mq = window.matchMedia('(min-width: 768px)')
  isDesktop.value = _mq.matches
  _mqHandler = (e) => { isDesktop.value = e.matches; updateSlideHeight() }
  _mq.addEventListener('change', _mqHandler)

  _dmq = window.matchMedia('(prefers-color-scheme: dark)')
  _dmqHandler = (e) => {
    // Only follow OS changes if the user hasn't set a manual preference
    if (localStorage.getItem('theme') === null) {
      isDarkMode.value = e.matches
    }
  }
  _dmq.addEventListener('change', _dmqHandler)

  updateSlideHeight()
})
onUnmounted(() => {
  window.removeEventListener('resize', checkTempWidths)
  window.removeEventListener('resize', updateSlideHeight)
  if (_mq && _mqHandler) _mq.removeEventListener('change', _mqHandler)
  if (_dmq && _dmqHandler) _dmq.removeEventListener('change', _dmqHandler)
  if (_loadingInterval) { clearInterval(_loadingInterval); _loadingInterval = null }
  document.body.classList.remove('is-dark')
})

// Split into recent (≤7 days) and old (>7 days)
const recentDays = computed(() => days.value.filter((d) => !d.isOld))

// Today / tomorrow / stack-cutoff date strings
const todayStr = new Date().toLocaleDateString('en-CA')
const tomorrowStr = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString('en-CA')
})()
const stackCutoffStr = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return d.toLocaleDateString('en-CA')
})()

// Group ALL days by "YYYY-MM" and build calendar grids
const HU_MONTHS = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
]
function isoWeekday(dateStr: string) {
  return (new Date(dateStr).getDay() + 6) % 7
}

// ── Desktop / mobile detection ──
const isDesktop = ref(false)

// ── Slide-wrap height (animates between months with different row counts) ──
const calSlideWrapRef = ref<{ $el: HTMLElement } | null>(null)
const slideWrapHeight = ref<number | null>(null)

async function updateSlideHeight() {
  if (isDesktop.value) { slideWrapHeight.value = null; return }
  await nextTick()
  const el = calSlideWrapRef.value?.$el
  if (!el) return
  // During a transition two .cal-month divs are present; the leaving one is
  // position:absolute — we want the height of the entering (in-flow) one.
  const months = el.querySelectorAll<HTMLElement>('.cal-month')
  for (const m of Array.from(months)) {
    if (getComputedStyle(m).position !== 'absolute') {
      slideWrapHeight.value = m.offsetHeight
      return
    }
  }
}
// Initialise from localStorage (user override) or fall back to OS preference
const _storedTheme = localStorage.getItem('theme')
const isDarkMode = ref(
  _storedTheme !== null
    ? _storedTheme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
)
// Keep document.body in sync — needed for the teleported cal-popover
watch(isDarkMode, (dark) => {
  document.body.classList.toggle('is-dark', dark)
}, { immediate: true })

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

// ── Month navigation (mobile single-month view) ──
const currentMonthKey = ref(new Date().toLocaleDateString('en-CA').slice(0, 7))

const calendarMonths = computed(() => {
  type Entry = (typeof days.value)[0]
  type Cell = { date: string | null; entry: Entry | null }
  const byMonth: Record<string, Entry[]> = {}
  for (const d of days.value) {
    const key = d.target_date.slice(0, 7)
    ;(byMonth[key] ??= []).push(d)
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, entries]) => {
      const [y, m] = key.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const firstWeekday = isoWeekday(`${key}-01`)
      const byDate = Object.fromEntries(entries.map((e) => [e.target_date, e]))
      // Padding cells have date: null; real days carry their date even without data
      const flat: Cell[] = Array.from({ length: firstWeekday }, () => ({ date: null, entry: null }))
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${key}-${String(day).padStart(2, '0')}`
        flat.push({ date: dateStr, entry: byDate[dateStr] ?? null })
      }
      // Pad to the end of the last needed week only (no trailing blank row)
      while (flat.length % 7 !== 0) flat.push({ date: null, entry: null })
      return { key, year: y, month: m, label: `${y}. ${HU_MONTHS[m - 1]}`, grid: flat }
    })
})

// Clamp currentMonthKey to available data when history loads
watch(calendarMonths, (months) => {
  const keys = months.map((m) => m.key) // already sorted newest-first
  if (keys.length && !keys.includes(currentMonthKey.value)) {
    const thisMonth = new Date().toLocaleDateString('en-CA').slice(0, 7)
    currentMonthKey.value = keys.includes(thisMonth) ? thisMonth : keys[0]
  }
  updateSlideHeight()
})

// Re-measure height whenever the displayed month changes
watch(currentMonthKey, () => { updateSlideHeight() })

const availableKeys = computed(
  () =>
    calendarMonths.value
      .map((m) => m.key)
      .slice()
      .sort(), // ascending (oldest first)
)
const currentMonthIdx = computed(() => availableKeys.value.indexOf(currentMonthKey.value))
const canGoPrev = computed(() => currentMonthIdx.value > 0)
const canGoNext = computed(() => currentMonthIdx.value < availableKeys.value.length - 1)

const slideDirection = ref<'left' | 'right'>('left')

function prevMonth() {
  if (canGoPrev.value) {
    slideDirection.value = 'right'
    currentMonthKey.value = availableKeys.value[currentMonthIdx.value - 1]
  }
}
function nextMonth() {
  if (canGoNext.value) {
    slideDirection.value = 'left'
    currentMonthKey.value = availableKeys.value[currentMonthIdx.value + 1]
  }
}
function jumpToMonth(key: string) {
  slideDirection.value = key > currentMonthKey.value ? 'left' : 'right'
  currentMonthKey.value = key
}

const displayedMonths = computed(() =>
  isDesktop.value
    ? calendarMonths.value.slice().reverse() // oldest → newest left to right
    : calendarMonths.value.filter((m) => m.key === currentMonthKey.value),
)

const currentMonthLabel = computed(
  () => calendarMonths.value.find((m) => m.key === currentMonthKey.value)?.label ?? '',
)

// Swipe detection
let _touchStartX = 0
function onCalTouchStart(e: TouchEvent) {
  _touchStartX = e.touches[0].clientX
}
function onCalTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - _touchStartX
  if (Math.abs(dx) > 48) {
    if (dx < 0) nextMonth()
    else prevMonth()
  }
}
</script>

<template>
  <div class="forecast-history" :class="{ 'is-dark': isDarkMode }">
    <button
      class="theme-toggle"
      :title="isDarkMode ? 'Világos mód' : 'Sötét mód'"
      @click="toggleTheme"
    >◑</button>
    <div v-if="loading" class="state-msg state-loading">
      <Transition name="weather-emoji" mode="out-in">
        <span :key="loadingEmojiIdx" class="loading-emoji">{{ LOADING_EMOJIS[loadingOrder[loadingEmojiIdx]] }}</span>
      </Transition>
      <Transition name="weather-emoji" mode="out-in">
        <span :key="loadingEmojiIdx" class="loading-text">{{ LOADING_TEXTS[loadingOrder[loadingEmojiIdx]] }}</span>
      </Transition>
    </div>
    <div v-else-if="error" class="state-msg state-error">{{ error }}</div>
    <!-- ── Recent days: full cards ── -->
    <div
      v-for="day in recentDays"
      :key="day.target_date"
      class="day-card"
      :class="[
        day.bg ? 'day-card--gradient' : day.style.card,
        {
          'day-card--today': day.isToday,
          'day-card--tomorrow': day.isTomorrow,
          'day-card--has-history': day.hasOnDayChanges,
        },
      ]"
      :style="day.bg ? { background: day.bg } : {}"
    >
      <div class="card-body" :class="{ 'no-history': !day.hasOnDayChanges }">
        <div
          class="card-left"
          :class="{
            'card-left--expandable': day.hasOnDayChanges,
            'card-left--open': expandedDays[day.target_date],
          }"
          @click="day.hasOnDayChanges && toggleDay(day.target_date)"
        >
          <div class="card-date-block">
            <div class="card-title-row">
              <span v-if="day.isYesterday" class="yesterday-badge">Tegnap</span>
              <span v-else-if="day.isDayBeforeYesterday" class="day-weekday">Tegnapelőtt</span>
              <span v-else-if="day.isToday" class="today-badge">Ma</span>
              <span v-else-if="day.isTomorrow" class="tomorrow-badge">Holnap</span>
              <span v-else class="day-weekday">{{ fmtWeekday(day.target_date) }}</span>
            </div>
            <span class="day-date">{{ fmtShortDate(day.target_date) }}</span>
          </div>
          <span class="front-pill" :class="day.bg ? 'front-mixed' : day.style.pill">{{
            day.style.label
          }}</span>
          <div v-if="day.temp_min && day.temp_max" class="weather-col">
            <span class="weather-temp">{{ day.temp_min }} / {{ day.temp_max }}</span>
          </div>
        </div>
        <div
          v-if="day.hasOnDayChanges"
          class="card-right"
          :class="{ 'card-right--collapsed': !expandedDays[day.target_date] }"
        >
          <div class="timeline">
            <template v-for="(entry, i) in day.entriesWithChanges" :key="i">
              <div
                class="timeline-row"
                :class="{ 'timeline-row--connected': i < day.entriesWithChanges.length - 1 }"
              >
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
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- ── History divider ── -->
    <div v-if="calendarMonths.length" class="history-divider">
      <span class="history-divider-label">Előzmények</span>
    </div>

    <!-- ── Month nav (mobile only) ── -->
    <div v-if="calendarMonths.length && !isDesktop" class="cal-nav">
      <button class="cal-nav-btn" :disabled="!canGoPrev" @click="prevMonth">‹</button>
      <span class="cal-nav-label">{{ currentMonthLabel }}</span>
      <button class="cal-nav-btn" :disabled="!canGoNext" @click="nextMonth">›</button>
    </div>

    <!-- ── All data: calendar view ── -->
    <TransitionGroup
      v-if="calendarMonths.length"
      ref="calSlideWrapRef"
      :name="isDesktop ? '' : 'cal-slide-' + slideDirection"
      tag="div"
      class="cal-section"
      :class="{ 'cal-section--annual': isDesktop, 'cal-slide-wrap': !isDesktop }"
      :style="!isDesktop && slideWrapHeight ? { height: slideWrapHeight + 'px' } : {}"
      @touchstart="onCalTouchStart"
      @touchend="onCalTouchEnd"
    >
      <div
        v-for="month in displayedMonths"
        :key="month.key"
        class="cal-month"
        @click.self="closeCalPopover"
      >
        <div v-if="isDesktop" class="cal-month-label">{{ month.label }}</div>
        <div class="cal-grid">
          <!-- Weekday headers Mon–Sun -->
          <div
            v-for="h in ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']"
            :key="h"
            class="cal-weekday-header"
          >
            {{ h }}
          </div>
          <!-- Day cells -->
          <template v-for="(cell, i) in month.grid" :key="i">
            <div
              v-if="cell.date"
              class="cal-cell"
              :class="[
                cell.entry
                  ? cell.entry.bg
                    ? 'day-card--gradient'
                    : cell.entry.style.card
                  : cell.date! > tomorrowStr
                    ? 'cal-cell--future'
                    : 'cal-cell--no-data',
                {
                  'cal-cell--selected': selectedCalDate === cell.date,
                  'cal-cell--in-stack':
                    cell.date !== null && cell.date >= stackCutoffStr && cell.date <= tomorrowStr,
                  'cal-cell--today': cell.date === todayStr,
                  'cal-cell--tomorrow': cell.date === tomorrowStr,
                },
              ]"
              :style="cell.entry?.bg ? { background: cell.entry.bg } : {}"
              @click.stop="cell.entry ? openCalPopover($event, cell.date) : closeCalPopover()"
            >
              <span class="cal-day-num">{{ Number(cell.date.slice(8)) }}</span>
              <div v-if="cell.entry?.temp_min && cell.entry?.temp_max" class="cal-temp-area">
                <span class="cal-temp">{{ cell.entry.temp_min }} / {{ cell.entry.temp_max }}</span>
              </div>
              <span v-if="cell.entry?.entriesWithChanges.length" class="cal-change-dot"></span>
            </div>
            <div v-else class="cal-cell cal-cell--empty"></div>
          </template>
        </div>

      </div>
    </TransitionGroup>

    <!-- Calendar day popover — teleported to body so it floats over the page -->
    <Teleport to="body">
      <div
        v-if="selectedCalDay"
        class="cal-popover"
        :style="{
          top: calPopoverPos.top + 'px',
          left: calPopoverPos.left + 'px',
          width: calPopoverPos.width + 'px',
        }"
      >
        <div class="cal-popover-header">
          <div class="cal-popover-header-top">
            <span class="cal-popover-date"
              >{{ fmtShortDate(selectedCalDay.target_date) }} ·
              {{ fmtWeekday(selectedCalDay.target_date) }}</span
            >
            <button class="cal-popover-close" @click.stop="closeCalPopover">✕</button>
          </div>
          <div class="cal-popover-header-bottom">
            <span
              class="front-pill cal-popover-pill"
              :class="selectedCalDay.style.pill"
              >{{ selectedCalDay.style.label }}</span
            >
            <span v-if="selectedCalDay.temp_min" class="cal-popover-temp"
              >{{ selectedCalDay.temp_min }} / {{ selectedCalDay.temp_max }}</span
            >
          </div>
        </div>
        <div
          v-if="selectedCalDay.entriesWithChanges.length"
          class="timeline cal-popover-timeline"
        >
          <template v-for="(entry, i) in selectedCalDay.entriesWithChanges" :key="i">
            <div
              class="timeline-row"
              :class="{
                'timeline-row--connected': i < selectedCalDay.entriesWithChanges.length - 1,
              }"
            >
              <div class="dot" :class="frontStyle(entry.data.front_type).dot"></div>
              <span class="tl-time">{{ fmt(entry.observed_at) }}</span>
              <span class="tl-inline-changes">
                <span v-for="(change, ci) in entry.changes" :key="change.field">
                  <span v-if="ci > 0" class="tl-sep"> · </span>
                  <span class="tl-from">{{ change.from }}</span>
                  <span class="tl-arrow"> → </span>
                  <span class="tl-to">{{ change.to }}</span>
                </span>
              </span>
            </div>
          </template>
        </div>
        <div v-else class="cal-popover-no-changes">Nincs változás ezen a napon.</div>
      </div>
    </Teleport>

    <!-- ── Pagination dots (mobile only) ── -->
    <div v-if="!isDesktop && calendarMonths.length" class="cal-dots">
      <span
        v-for="key in availableKeys"
        :key="key"
        class="cal-dot"
        :class="{ 'cal-dot--active': key === currentMonthKey }"
        @click="jumpToMonth(key)"
      ></span>
    </div>
  </div>
</template>

<style scoped>
.forecast-history {
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* ── Theme toggle (fixed bottom-right) ── */
.theme-toggle {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  z-index: 100;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid rgba(120, 120, 120, 0.25);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.2s, box-shadow 0.2s;
  color: #444;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.theme-toggle:hover {
  opacity: 1;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
}
.theme-toggle:active {
  opacity: 1;
  transform: scale(0.95);
}
.is-dark .theme-toggle {
  background: rgba(40, 40, 40, 0.75);
  border-color: rgba(255, 255, 255, 0.15);
  color: #ccc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

/* ── History divider ── */
.history-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 1.5rem 0 0.75rem;
}

.history-divider::before,
.history-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
}

.history-divider-label {
  font-size: 11px;
  font-weight: 600;
  color: #bbb;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* temp hidden on mobile */
.cal-temp-area {
  display: none;
}

@media (min-width: 500px) {
  .cal-day-num {
    font-size: 20px !important;
  }
  .cal-weekday-header {
    font-size: 13px !important;
    padding-bottom: 6px !important;
  }
  .cal-month-label {
    font-size: 15px !important;
    margin-bottom: 0.75rem !important;
  }
  .cal-change-dot {
    width: 6px !important;
    height: 6px !important;
    bottom: 8px !important;
    right: 8px !important;
  }
  .cal-cell {
    border-radius: 8px !important;
  }
  .cal-grid {
    gap: 5px !important;
  }
  .cal-temp-area {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    width: 100%;
    overflow: hidden;
    min-height: 0;
  }
  .cal-temp {
    font-size: 13px;
    font-weight: 400;
    color: #999;
    line-height: 1;
    white-space: nowrap;
  }
}

/* ── Month navigation (mobile) ── */
.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.75rem 0 0.25rem;
}
.cal-nav-btn {
  background: none;
  border: none;
  font-size: 26px;
  color: #888;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 8px;
  line-height: 1;
  transition: background 0.12s;
}
.cal-nav-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
}
.cal-nav-btn:disabled {
  color: #ddd;
  cursor: default;
}
.cal-nav-label {
  font-size: 16px;
  font-weight: 600;
  color: #555;
  text-transform: capitalize;
}

/* ── Slide transition ── */
.cal-slide-wrap {
  position: relative;
  overflow: hidden;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.cal-slide-left-enter-active,
.cal-slide-left-leave-active,
.cal-slide-right-enter-active,
.cal-slide-right-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s;
}

.cal-slide-left-leave-active,
.cal-slide-right-leave-active {
  position: absolute !important;
  top: 0;
  left: 0;
  width: 100%;
}

.cal-slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.cal-slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
.cal-slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.cal-slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* ── Pagination dots ── */
.cal-dots {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 10px 0 2px;
}
.cal-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition:
    width 0.2s,
    background 0.2s,
    border-radius 0.2s;
  flex-shrink: 0;
}
.cal-dot--active {
  width: 18px;
  border-radius: 3px;
  background: #44403c;
}

/* ── Calendar section ── */
.cal-section {
  margin-top: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Annual grid (desktop) */
.cal-section--annual {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  align-items: start;
}
@media (min-width: 1100px) {
  .cal-section--annual {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Compact cells in annual view */
.cal-section--annual .cal-day-num {
  font-size: 12px !important;
}
.cal-section--annual .cal-weekday-header {
  font-size: 10px !important;
  padding-bottom: 2px !important;
}
.cal-section--annual .cal-month-label {
  font-size: 12px !important;
  margin-bottom: 0.35rem !important;
}
.cal-section--annual .cal-cell {
  border-radius: 4px !important;
  padding: 3px 4px !important;
}
.cal-section--annual .cal-grid {
  gap: 2px !important;
}
.cal-section--annual .cal-temp-area {
  display: none !important;
}
.cal-section--annual .cal-change-dot {
  width: 4px !important;
  height: 4px !important;
  bottom: 3px !important;
  right: 3px !important;
}

.cal-month {
  background: rgba(0, 0, 0, 0.02);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 0.875rem 1rem;
  position: relative;
}

.cal-month-label {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: capitalize;
  margin-bottom: 0.5rem;
  letter-spacing: 0.02em;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}

.cal-weekday-header {
  font-size: 10px;
  color: #bbb;
  text-align: center;
  padding-bottom: 3px;
  font-weight: 500;
}

.cal-cell {
  aspect-ratio: 1;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 5px 6px;
  position: relative;
  cursor: default;
  transition: opacity 0.15s;
}

.cal-cell:hover {
  opacity: 0.8;
  border-color: rgba(0, 0, 0, 0.25);
}

.cal-cell--empty {
  background: transparent;
  border-color: transparent;
}

.cal-cell--no-data {
  background: transparent;
  cursor: default;
}

.cal-cell--no-data .cal-day-num {
  color: rgba(0, 0, 0, 0.2);
}

.cal-cell--future {
  background: transparent;
  border-color: rgba(0, 0, 0, 0.06);
  cursor: default;
}

.cal-cell--future .cal-day-num {
  opacity: 0.35;
}

.cal-cell--in-stack {
  outline: 1px solid rgba(0, 0, 0, 0.12);
  outline-offset: -1px;
}

.cal-cell--today .cal-day-num {
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  margin: -1px 0 0 -1px;
}

.cal-cell--tomorrow .cal-day-num {
  border: 1.5px solid rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  margin: -1px 0 0 -1px;
}

.cal-day-num {
  font-size: 15px;
  font-weight: 500;
  color: #555;
  line-height: 1;
}

.cal-change-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  position: absolute;
  bottom: 6px;
  right: 6px;
}

.cal-cell--selected {
  outline: 2px solid rgba(0, 0, 0, 0.35);
  outline-offset: -2px;
}

.cal-popover {
  position: fixed;
  background: #fff;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  z-index: 1000;
}

.cal-popover-header {
  margin-bottom: 10px;
}

.cal-popover-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.cal-popover-header-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-popover-date {
  font-size: 13px;
  color: #888;
}


.cal-popover-temp {
  font-size: 13px;
  font-weight: 500;
  color: #44403c;
}

.cal-popover-close {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 12px;
  color: #bbb;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}

.cal-popover-close:hover {
  color: #666;
}

.cal-popover-timeline {
  border-top: 0.5px solid rgba(0, 0, 0, 0.07);
  padding-top: 8px;
  max-height: 220px;
  overflow-y: auto;
}

@media (min-width: 768px) {
  .cal-popover {
    min-width: 280px;
  }
  .cal-popover-timeline {
    max-height: none;
    overflow-y: visible;
  }
  /* Desktop header: two-row layout with tighter spacing */
  .cal-popover-header {
    margin-bottom: 8px;
  }
  .cal-popover-header-top {
    margin-bottom: 4px;
  }
  .cal-popover-date {
    font-size: 11px;
  }
  .cal-popover-temp {
    font-size: 11px;
  }
  .cal-popover-timeline .tl-time,
  .cal-popover-timeline .tl-inline-changes {
    font-size: 11px;
  }
}

/* Each change on its own line inside the popover */
.cal-popover-timeline .tl-inline-changes {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cal-popover-timeline .tl-inline-changes > span {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.cal-popover-timeline .tl-sep {
  display: none;
}

.cal-popover-timeline .timeline-row {
  padding: 5px 0;
  align-items: flex-start;
}

.cal-popover-no-changes {
  font-size: 12px;
  color: #aaa;
  padding-top: 8px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.07);
}

.state-msg {
  text-align: center;
  padding: 2rem;
  color: #888;
  font-size: 14px;
}

.state-loading {
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  overflow: hidden;
}

.loading-emoji {
  font-size: 2rem;
  display: block;
  line-height: 1;
}

.loading-text {
  font-size: 13px;
  color: #aaa;
  display: block;
  text-align: center;
}

.is-dark .loading-text {
  color: #666;
}

.weather-emoji-enter-active,
.weather-emoji-leave-active {
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.weather-emoji-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.weather-emoji-enter-to {
  opacity: 1;
  transform: translateX(0);
}
.weather-emoji-leave-from {
  opacity: 1;
  transform: translateX(0);
}
.weather-emoji-leave-to {
  opacity: 0;
  transform: translateX(20px);
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
  align-items: stretch;
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
  .day-weekday {
    font-size: 16px !important;
  }
  .day-date {
    font-size: 13px !important;
  }
  .front-pill {
    font-size: 14px !important;
    padding: 6px 14px !important;
  }
  .today-badge,
  .tomorrow-badge {
    font-size: 13px !important;
    padding: 3px 10px !important;
  }
  .yesterday-badge {
    font-size: 16px !important;
  }
  .weather-temp {
    font-size: 14px !important;
    padding-left: 14px !important;
  }
  .weather-temp {
    font-size: 18px;
  }
  .weather-wind {
    font-size: 16px;
  }
}

/* Popover pill — must be after the @media (min-width: 769px) .front-pill rule to win */
/* Mobile: original compact pill */
.cal-popover-pill {
  font-size: 13px !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  padding: 3px 9px !important;
  border-radius: 6px !important;
}
/* Desktop: smaller pill to match the tighter annual-grid scale */
@media (min-width: 768px) {
  .cal-popover-pill {
    font-size: 11px !important;
    padding: 3px 7px !important;
    border-radius: 4px !important;
  }
}

.card-cold {
  background: #e6f1fb;
  border-color: #b5d4f4;
}
.card-warm {
  background: #fef2f2;
  border-color: #fca5a5;
}
.card-no {
  background: #f1efe8;
  border-color: #d3d1c7;
}
.card-stationary {
  background: #fff7ed;
  border-color: #fdba74;
}
.card-double {
  background: #ede9fe;
  border-color: #c4b5fd;
}

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

.front-mixed {
  background: rgba(255, 255, 255, 0.55);
  color: #44403c;
}
.front-cold {
  background: #e6f1fb;
  color: #0c447c;
}
.front-warm {
  background: #fef2f2;
  color: #991b1b;
}
.front-no {
  background: #f1efe8;
  color: #444441;
}
.front-stationary {
  background: #fff7ed;
  color: #9a3412;
}
.front-double {
  background: #ede9fe;
  color: #5b21b6;
}

.timeline {
  padding-top: 0;
}

.timeline-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 4px 0;
  position: relative;
}

.timeline-row--connected::after {
  content: '';
  position: absolute;
  left: 6px;
  top: calc(4px + 2px + 13px + 4px);
  bottom: -2px;
  width: 1px;
  background: rgba(0, 0, 0, 0.15);
}

.dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
  position: relative;
  border: 1.5px solid;
}

.dot-cold {
  background: #b5d4f4;
  border-color: #378add;
}
.dot-warm {
  background: #fca5a5;
  border-color: #ef4444;
}
.dot-no {
  background: #d3d1c7;
  border-color: #888780;
}
.dot-stationary {
  background: #fdba74;
  border-color: #f97316;
}
.dot-double {
  background: #c4b5fd;
  border-color: #7c3aed;
}

.tl-time {
  font-size: 12px;
  color: #888;
  min-width: 90px;
  padding-top: 1px;
}

.tl-inline-changes {
  font-size: 12px;
}

.tl-from {
  color: #888;
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

/* ── Dark theme ──
   Driven by the .is-dark class set on both the component root and document.body
   (body class is needed for the teleported cal-popover).
   isDarkMode ref mirrors prefers-color-scheme via matchMedia so OS dark mode
   is still respected; the class just makes it testable without the media query.
*/

/* Divider */
.is-dark .history-divider::before,
.is-dark .history-divider::after { background: rgba(255, 255, 255, 0.1); }
.is-dark .history-divider-label  { color: #78716c; }

/* Calendar month card */
.is-dark .cal-month        { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.1); }
.is-dark .cal-month-label  { color: #a8a29e; }
.is-dark .cal-weekday-header { color: #57534e; }

/* Nav */
.is-dark .cal-nav-label              { color: #d6d3d1; }
.is-dark .cal-nav-btn                { color: #78716c; }
.is-dark .cal-nav-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
.is-dark .cal-nav-btn:disabled       { color: #44403c; }

/* Cells */
.is-dark .cal-cell          { border-color: rgba(255, 255, 255, 0.08); }
.is-dark .cal-cell:hover    { border-color: rgba(255, 255, 255, 0.22); }
.is-dark .cal-cell--empty   { border-color: transparent; }
.is-dark .cal-cell--future  { border-color: rgba(255, 255, 255, 0.05); }
.is-dark .cal-cell--no-data .cal-day-num { color: rgba(255, 255, 255, 0.18); }
.is-dark .cal-day-num       { color: #a8a29e; }
.is-dark .cal-cell--in-stack { outline-color: rgba(255, 255, 255, 0.14); }
.is-dark .cal-cell--today .cal-day-num {
  background: rgba(255, 255, 255, 0.82);
  color: #1c1917;
}
.is-dark .cal-cell--tomorrow .cal-day-num { border-color: rgba(255, 255, 255, 0.25); color: #a8a29e; }
.is-dark .cal-cell--selected { outline-color: rgba(255, 255, 255, 0.4); }

/* Card cell & day-card backgrounds */
.is-dark .card-cold       { background: #223850; border-color: #3a6080; }
.is-dark .card-warm       { background: #3e2424; border-color: #6e3838; }
.is-dark .card-no         { background: #302d2a; border-color: #504c48; }
.is-dark .card-stationary { background: #3c2a10; border-color: #6e4e20; }
.is-dark .card-double     { background: #2c2248; border-color: #503880; }

/* Front type pills */
.is-dark .front-cold       { background: #2a4e72; color: #93c5fd; }
.is-dark .front-warm       { background: #4e2828; color: #fca5a5; }
.is-dark .front-no         { background: #3e3b37; color: #d6d3d1; }
.is-dark .front-stationary { background: #4e3010; color: #fdba74; }
.is-dark .front-double     { background: #3c2c6e; color: #c4b5fd; }
.is-dark .front-mixed      { background: rgba(255, 255, 255, 0.12); color: #d6d3d1; }

/* Dots */
.is-dark .dot-cold       { background: #60a5fa; border-color: #60a5fa; }
.is-dark .dot-warm       { background: #f87171; border-color: #f87171; }
.is-dark .dot-no         { background: #a8a29e; border-color: #a8a29e; }
.is-dark .dot-stationary { background: #fb923c; border-color: #fb923c; }
.is-dark .dot-double     { background: #a78bfa; border-color: #a78bfa; }

/* Cal change dot */
.is-dark .cal-change-dot { background: rgba(255, 255, 255, 0.35); }

/* Popover (teleported to body — body.is-dark is the ancestor) */
.is-dark .cal-popover {
  background: #1c1917;
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}
.is-dark .cal-popover-date     { color: #78716c; }
.is-dark .cal-popover-temp     { color: #d6d3d1; }
.is-dark .cal-popover-close    { color: #57534e; }
.is-dark .cal-popover-close:hover { color: #a8a29e; }
.is-dark .cal-popover-timeline { border-top-color: rgba(255, 255, 255, 0.07); }
.is-dark .cal-popover-no-changes { color: #57534e; }

/* Timeline */
.is-dark .timeline-row           { border-top-color: rgba(255, 255, 255, 0.06); }
.is-dark .timeline-row--connected::after { background: rgba(255, 255, 255, 0.12); }
.is-dark .tl-time  { color: #78716c; }
.is-dark .tl-from  { color: #78716c; }
.is-dark .tl-arrow { color: #57534e; }
.is-dark .tl-to    { color: #d6d3d1; }
.is-dark .tl-sep   { color: #44403c; }
.is-dark .tl-label { color: #a8a29e; }

/* Calendar extras */
.is-dark .cal-temp      { color: #78716c; }
.is-dark .cal-dot       { background: rgba(255, 255, 255, 0.15); }
.is-dark .cal-dot--active { background: rgba(255, 255, 255, 0.65); }

/* ── Recent day cards ── */
.is-dark .day-card                    { border-color: rgba(255, 255, 255, 0.10); }
.is-dark .day-card--today             { border-color: rgba(255, 255, 255, 0.70); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4); }
.is-dark .day-card--gradient.day-card--today { border-color: rgba(255, 255, 255, 0.25); }
.is-dark .day-card--tomorrow          { border-color: rgba(255, 255, 255, 0.25); }
.is-dark .day-card--has-history       { box-shadow: inset 0 -3px 0 rgba(255, 255, 255, 0.07); }

/* Badges & text */
.is-dark .today-badge    { background: rgba(255, 255, 255, 0.88); color: #1c1917; }
.is-dark .tomorrow-badge { color: #78716c; border-color: rgba(255, 255, 255, 0.2); }
.is-dark .yesterday-badge { color: #d6d3d1; }
.is-dark .day-weekday   { color: #d6d3d1; }
.is-dark .day-date       { color: #78716c; }
.is-dark .weather-temp   { color: #d6d3d1; }
.is-dark .card-right     { border-color: rgba(255, 255, 255, 0.08); }
</style>
