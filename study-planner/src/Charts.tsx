import type { CSSProperties } from 'react'
import { formatJalaliDate } from './utils'

export function BarWeek({
  labels,
  values,
  accent = '#7c5cff',
}: {
  labels: string[]
  values: number[]
  accent?: string
}) {
  const max = Math.max(...values, 1)
  const w = 320
  const h = 148
  const pad = 8
  const gap = 8
  const barW = (w - pad * 2 - gap * (values.length - 1)) / values.length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="ساعت مطالعه هفته">
      {values.map((v, i) => {
        const bh = (v / max) * 100
        const x = pad + i * (barW + gap)
        const y = 112 - bh
        const active = v === Math.max(...values) && v > 0
        return (
          <g key={labels[i]}>
            <rect x={x} y={12} width={barW} height={100} rx={10} fill="rgba(255,255,255,0.04)" />
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx={10}
              fill={active ? accent : 'url(#barFill)'}
              opacity={v ? 1 : 0.35}
            />
            <text x={x + barW / 2} y={132} textAnchor="middle" className="chart-label">
              {labels[i]}
            </text>
          </g>
        )
      })}
      <defs>
        <linearGradient id="barFill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3ee0b5" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Donut({
  slices,
}: {
  slices: { name: string; value: number; color: string }[]
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1
  const r = 42
  const c = 2 * Math.PI * r
  const segments = slices.reduce<Array<{ name: string; value: number; color: string; dash: string; len: number; offset: number }>>(
    (acc, s) => {
      const len = (s.value / total) * c
      const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0
      acc.push({
        ...s,
        dash: `${len} ${c - len}`,
        len,
        offset,
      })
      return acc
    },
    [],
  )

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="توزیع دروس">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        {segments.map((s) => (
          <circle
            key={s.name}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={s.dash}
            strokeDashoffset={-s.offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        ))}
        <text x="60" y="56" textAnchor="middle" className="donut-num">
          {Math.round(slices.reduce((a, s) => a + s.value, 0) / 60)}
        </text>
        <text x="60" y="74" textAnchor="middle" className="donut-sub">
          ساعت هفته
        </text>
      </svg>
      <ul className="legend">
        {slices.map((s) => (
          <li key={s.name}>
            <span style={{ background: s.color }} />
            {s.name}
            <b>{s.value}د</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Ring({
  value,
  max,
  label,
  color = '#3ee0b5',
}: {
  value: number
  max: number
  label: string
  color?: string
}) {
  const pct = Math.min(1, max ? value / max : 0)
  const r = 36
  const c = 2 * Math.PI * r
  return (
    <div className="ring">
      <svg viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="45"
          cy="45"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          transform="rotate(-90 45 45)"
        />
        <text x="45" y="50" textAnchor="middle" className="ring-pct">
          {Math.round(pct * 100)}٪
        </text>
      </svg>
      <span>{label}</span>
    </div>
  )
}

export function Heatmap({ days }: { days: { date: string; minutes: number }[] }) {
  const max = Math.max(...days.map((d) => d.minutes), 1)
  return (
    <div className="heat" role="img" aria-label="نقشه چهار هفته اخیر">
      {days.map((d) => {
        const t = d.minutes / max
        const style = {
          '--t': String(t),
          background: d.minutes
            ? `color-mix(in srgb, #3ee0b5 ${Math.round(30 + t * 70)}%, #7c5cff)`
            : 'rgba(255,255,255,0.06)',
        } as CSSProperties
        return <span key={d.date} title={`${formatJalaliDate(d.date)}: ${d.minutes} دقیقه`} style={style} />
      })}
    </div>
  )
}
