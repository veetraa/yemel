import { motion } from 'framer-motion'
import type { Pose, Pt, Template } from '../lib/pose'

type Key = 'head' | 'shoulder' | 'hip' | 'elbow' | 'hand' | 'knee' | 'foot' | 'knee2' | 'foot2' | 'toe'

const get = (p: Pose, k: Key): Pt => {
  if (k === 'toe') return p.toe ?? [p.foot[0] + 14, p.foot[1]]
  if (k === 'knee2') return p.knee2 ?? [p.knee[0] - 6, p.knee[1]]
  if (k === 'foot2') return p.foot2 ?? [p.foot[0] - 6, p.foot[1]]
  return p[k]
}
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Segmentos que se resaltan en acento según el músculo principal */
const HIGHLIGHT: Record<string, ('torsoTop' | 'torsoLow' | 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'shoulder' | 'hip')[]> = {
  Pecho: ['torsoTop'], Espalda: ['torsoTop'], Hombros: ['shoulder'], Trapecio: ['shoulder'],
  'Bíceps': ['upperArm'], 'Tríceps': ['upperArm'], Antebrazos: ['forearm'],
  'Cuádriceps': ['thigh'], Isquiotibiales: ['thigh'], 'Glúteos': ['hip'], Gemelos: ['shin'], Core: ['torsoLow'],
}

const TIMES = [0, 0.42, 0.5, 0.92, 1]
const BODY = '#e8e8ec'
const FAR = 'rgba(255,255,255,.28)'
const ACCENT = '#9fd0ff'


interface Ctx { A: Pose; B: Pose; animated: boolean; tr: object }
type PF = (x: Pose) => Pt
const kf = (c: Ctx, f: PF, i: 0 | 1) => {
  const a = f(c.A)[i], b = f(c.B)[i]
  return c.animated ? [a, b, b, a, a] : a
}
function Line({ c, p, q, w, c2, o = 1 }: { c: Ctx; p: PF; q: PF; w: number; c2: string; o?: number }) {
  return c.animated ? (
    <motion.line initial={false} animate={{ x1: kf(c, p, 0), y1: kf(c, p, 1), x2: kf(c, q, 0), y2: kf(c, q, 1) }} transition={c.tr}
      stroke={c2} strokeWidth={w} strokeLinecap="round" opacity={o} />
  ) : (
    <line x1={p(c.A)[0]} y1={p(c.A)[1]} x2={q(c.A)[0]} y2={q(c.A)[1]} stroke={c2} strokeWidth={w} strokeLinecap="round" opacity={o} />
  )
}
function Dot({ c, p, r, c2, stroke, o = 1 }: { c: Ctx; p: PF; r: number; c2: string; stroke?: string; o?: number }) {
  const sw = stroke ? { stroke, strokeWidth: 4 } : {}
  return c.animated ? (
    <motion.circle initial={false} animate={{ cx: kf(c, p, 0), cy: kf(c, p, 1) }} transition={c.tr} r={r} fill={c2} opacity={o} {...sw} />
  ) : (
    <circle cx={p(c.A)[0]} cy={p(c.A)[1]} r={r} fill={c2} opacity={o} {...sw} />
  )
}

interface Props { template?: Template; primary?: string; animated?: boolean; className?: string }

export function StickFigure({ template: t, primary, animated = true, className = '' }: Props) {
  if (!t) return null
  const { A, B } = t
  const hl = HIGHLIGHT[primary ?? ''] ?? []
  const tr = { duration: 3.4, repeat: Infinity, ease: 'easeInOut' as const, times: TIMES }

  const cx: Ctx = { A, B, animated, tr }
  const k = (key: Key) => (p: Pose) => get(p, key)
  const midTop = (p: Pose) => lerp(p.shoulder, p.hip, 0.5)
  const midLow = (p: Pose) => lerp(p.shoulder, p.hip, 0.45)

  return (
    <svg viewBox="0 -16 240 196" className={className} role="img" aria-label="Animación del ejercicio" preserveAspectRatio="xMidYMid meet">
      {t.floor !== false && <line x1="10" y1="168" x2="230" y2="168" stroke="rgba(255,255,255,.16)" strokeWidth="2" strokeLinecap="round" />}
      {t.scene?.map((s, i) =>
        s.t === 'rect' ? (
          <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="3" fill="rgba(255,255,255,.14)" />
        ) : (
          <line key={i} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke="rgba(255,255,255,.22)" strokeWidth={s.w ?? 4} strokeLinecap="round" />
        ),
      )}
      {t.prop === 'cable' && t.anchor && (
        <>
          <circle cx={t.anchor[0]} cy={t.anchor[1]} r="4" fill="#3a3a41" />
          <Line c={cx} p={() => t.anchor!} q={k('hand')} w={1.6} c2="#6c6c75" />
        </>
      )}
      {/* pierna/brazo lejanos */}
      <Line c={cx} p={k('hip')} q={k('knee2')} w={8} c2={FAR} />
      <Line c={cx} p={k('knee2')} q={k('foot2')} w={7} c2={FAR} />
      {/* cuerpo */}
      <Line c={cx} p={k('hip')} q={k('knee')} w={9} c2={BODY} />
      <Line c={cx} p={k('knee')} q={k('foot')} w={7} c2={BODY} />
      <Line c={cx} p={k('foot')} q={k('toe')} w={5} c2={BODY} />
      <Line c={cx} p={k('shoulder')} q={k('hip')} w={11} c2={BODY} />
      <Dot c={cx} p={k('head')} r={8} c2="#0a0a0b" stroke={BODY} />
      <Line c={cx} p={k('shoulder')} q={k('elbow')} w={11} c2="#0a0a0b" />
      <Line c={cx} p={k('elbow')} q={k('hand')} w={10.5} c2="#0a0a0b" />
      <Line c={cx} p={k('shoulder')} q={k('elbow')} w={6.5} c2={BODY} />
      <Line c={cx} p={k('elbow')} q={k('hand')} w={6} c2={BODY} />
      {/* resalte del músculo principal */}
      {hl.includes('torsoTop') && <Line c={cx} p={k('shoulder')} q={midTop} w={11} c2={ACCENT} />}
      {hl.includes('torsoLow') && <Line c={cx} p={midLow} q={k('hip')} w={11} c2={ACCENT} />}
      {hl.includes('upperArm') && <Line c={cx} p={k('shoulder')} q={k('elbow')} w={6.5} c2={ACCENT} />}
      {hl.includes('forearm') && <Line c={cx} p={k('elbow')} q={k('hand')} w={6} c2={ACCENT} />}
      {hl.includes('thigh') && <Line c={cx} p={k('hip')} q={k('knee')} w={9} c2={ACCENT} />}
      {hl.includes('shin') && <Line c={cx} p={k('knee')} q={k('foot')} w={7} c2={ACCENT} />}
      {hl.includes('shoulder') && <Dot c={cx} p={k('shoulder')} r={7} c2={ACCENT} />}
      {hl.includes('hip') && <Dot c={cx} p={k('hip')} r={8} c2={ACCENT} />}
      {/* implemento */}
      {t.prop === 'barbell' && (
        <>
          <Dot c={cx} p={k('hand')} r={12} c2="#9b9ba4" />
          <Dot c={cx} p={k('hand')} r={4} c2="#0a0a0b" />
        </>
      )}
      {t.prop === 'dumbbell' && <Dot c={cx} p={k('hand')} r={7} c2="#9b9ba4" />}
      {t.prop === 'cable' && <Dot c={cx} p={k('hand')} r={4.5} c2="#9b9ba4" />}
    </svg>
  )
}
