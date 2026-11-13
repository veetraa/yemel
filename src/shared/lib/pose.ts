/** Tipos genéricos de las figuras animadas (las usan Gym y Combat, cada uno con sus propias plantillas). */
export type Pt = [number, number]
export interface Pose {
  head: Pt
  shoulder: Pt
  hip: Pt
  elbow: Pt
  hand: Pt
  knee: Pt
  foot: Pt
  /** Pierna lejana (zancadas) */
  knee2?: Pt
  foot2?: Pt
  toe?: Pt
}
export type Shape =
  | { t: 'line'; a: Pt; b: Pt; w?: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number }
export interface Template {
  A: Pose
  B: Pose
  prop?: 'barbell' | 'dumbbell' | 'cable' | 'bar' | 'none'
  anchor?: Pt
  scene?: Shape[]
  floor?: boolean
}

export const P = (
  head: Pt, shoulder: Pt, hip: Pt, elbow: Pt, hand: Pt, knee: Pt, foot: Pt, extra: Partial<Pose> = {},
): Pose => ({ head, shoulder, hip, elbow, hand, knee, foot, ...extra })
