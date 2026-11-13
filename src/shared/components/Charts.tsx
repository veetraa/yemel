import { formatDateShort, formatNumber } from '../lib/utils'

export function BarChart({ data, unit }: { data: { label: string; value: number; highlight?: boolean }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const W = 320, H = 130, pad = 22
  const bw = (W - pad) / data.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label={`Volumen semanal en ${unit}`}>
      {data.map((d, i) => {
        const h = Math.max(d.value ? 4 : 2, (d.value / max) * (H - 20))
        const x = pad / 2 + i * bw + bw * 0.18
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={bw * 0.64} height={h} rx={5} fill={d.highlight ? '#9fd0ff' : d.value ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.09)'} />
            {d.value > 0 && <text x={x + bw * 0.32} y={H - h - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill={d.highlight ? '#9fd0ff' : 'rgba(255,255,255,.72)'}>{d.value >= 1000 ? `${formatNumber(d.value / 1000, 1)}t` : Math.round(d.value)}</text>}
            <text x={x + bw * 0.32} y={H + 16} textAnchor="middle" fontSize="10" fill={d.highlight ? '#fff' : 'rgba(255,255,255,.5)'} fontWeight="600">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function LineChart({ points, unit }: { points: { ts: number; v: number }[]; unit: string }) {
  const W = 320, H = 150, px = 8, py = 20
  const vs = points.map((p) => p.v)
  const lo = Math.min(...vs), hi = Math.max(...vs)
  const span = hi - lo || 1
  const x = (i: number) => px + (points.length === 1 ? (W - 2 * px) / 2 : (i / (points.length - 1)) * (W - 2 * px))
  const y = (v: number) => py + (1 - (v - lo) / span) * (H - 2 * py)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`Evolución del 1RM estimado en ${unit}`}>
      {[0, 0.5, 1].map((t) => <line key={t} x1={px} x2={W - px} y1={py + t * (H - 2 * py)} y2={py + t * (H - 2 * py)} stroke="rgba(255,255,255,.1)" strokeWidth="1" />)}
      <path d={d} fill="none" stroke="#9fd0ff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? '#9fd0ff' : '#0a0a0b'} stroke="#9fd0ff" strokeWidth="2" />)}
      <text x={px} y={H + 14} fontSize="10" fill="rgba(255,255,255,.5)" fontWeight="600">{formatDateShort(points[0].ts)}</text>
      <text x={W - px} y={H + 14} textAnchor="end" fontSize="10" fill="rgba(255,255,255,.5)" fontWeight="600">{formatDateShort(last.ts)}</text>
      <text x={Math.min(W - 30, x(points.length - 1))} y={y(last.v) - 11} textAnchor="end" fontSize="11" fontWeight="700" fill="#fff">{formatNumber(last.v)}</text>
    </svg>
  )
}

export function StackedBars({ data }: { data: { label: string; a: number; b: number; highlight?: boolean }[] }) {
  const max = Math.max(1, ...data.map((d) => d.a + d.b))
  const W = 320, H = 120, pad = 22
  const bw = (W - pad) / data.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label="Carga semanal: gimnasio y otras actividades">
      {data.map((d, i) => {
        const x = pad / 2 + i * bw + bw * 0.18
        const w = bw * 0.64
        const ha = (d.a / max) * (H - 8)
        const hb = (d.b / max) * (H - 8)
        return (
          <g key={i}>
            {hb > 0 && <rect x={x} y={H - ha - hb} width={w} height={hb} rx={4} fill="#9fd0ff" opacity={d.highlight ? 1 : 0.55} />}
            {ha > 0 && <rect x={x} y={H - ha} width={w} height={Math.max(ha, 3)} rx={4} fill={d.highlight ? '#ffffff' : 'rgba(255,255,255,.42)'} />}
            {ha + hb === 0 && <rect x={x} y={H - 2} width={w} height={2} rx={1} fill="#1b1b1f" />}
            <text x={x + w / 2} y={H + 16} textAnchor="middle" fontSize="10" fontWeight="600" fill={d.highlight ? '#fff' : 'rgba(255,255,255,.5)'}>{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
