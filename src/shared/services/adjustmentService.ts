/**
 * adjustmentService — motor GLOBAL de ajuste: combina los indicadores de recuperación, la carga interna de
 * todas las disciplinas y la proximidad de combate. Gym consume su resultado; no al revés.
 */
import type { EngineCtx } from '../../types'
import { consecutiveHardDays, loadStatus, recentDemandingCombat } from './fatigueService'
import { T, type ReasonCode } from './principlesService'
import { demandingCombatTomorrow } from './planningService'
import { isDeloadActive, readiness } from './recoveryService'

const r1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export interface Adjustment {
  active: boolean
  /** Factor global de carga (≤ 1) */
  weightFactor: number
  /** Series a restar a todos los ejercicios con más de 2 series */
  setDelta: number
  /** Series a restar solo al tren inferior */
  lowerSetDelta: number
  lowerWeightFactor: number
  muscleSetDelta: Record<string, number>
  /** No subir de peso en nada / solo en el tren inferior */
  holdAll: boolean
  holdLower: boolean
  deload: boolean
  /** Sugerir convertir hoy en recuperación (muchos días duros seguidos) */
  suggestRecoveryDay: boolean
  notes: string[]
  codes: ReasonCode[]
}

export function planAdjustment(ctx: EngineCtx): Adjustment {
  const now = ctx.now ?? new Date()
  const r = readiness(ctx.wellness, now)
  const l = loadStatus(ctx.sessions, ctx.activities, now)
  const adj: Adjustment = {
    active: false, weightFactor: 1, setDelta: 0, lowerSetDelta: 0, lowerWeightFactor: 1, muscleSetDelta: {},
    holdAll: false, holdLower: false, deload: false, suggestRecoveryDay: false, notes: [], codes: [],
  }
  const note = (code: ReasonCode, text: string) => { adj.notes.push(text); if (!adj.codes.includes(code)) adj.codes.push(code) }

  if (isDeloadActive(ctx.profile, now)) {
    adj.deload = true; adj.weightFactor = T.DELOAD_LOAD; adj.holdAll = true
    note('DELOAD', `Semana de descarga: ≈${Math.round((1 - T.DELOAD_SET_SCALE) * 100)} % menos series y ≈${Math.round((1 - T.DELOAD_LOAD) * 100)} % menos carga. En combate, evita sparring duro.`)
  } else if (r.level === 'low') {
    adj.weightFactor = T.LOW_READINESS_LOAD; adj.setDelta = -1; adj.holdAll = true
    note('LOW_READINESS', `Recuperación baja${r.reasons.length ? ` (${r.reasons.slice(0, 2).join(', ').toLowerCase()})` : ''}: −1 serie por ejercicio y ≈−8 % de carga.`)
  } else if (l.level === 'high') {
    adj.weightFactor = T.HIGH_LOAD_LOAD; adj.setDelta = -1; adj.holdAll = true
    note('HIGH_LOAD', `Carga de los últimos 7 días muy superior a tu media (×${r1(l.ratio ?? 0)}): −1 serie y ≈−5 % de carga.`)
  } else if (l.level === 'elevated') {
    adj.weightFactor = T.MODERATE_LOAD; adj.holdAll = true
    note('ELEVATED_LOAD', `Carga semanal elevada${l.ratio ? ` (×${r1(l.ratio)})` : ''}: ≈−5 % de carga y sin subir de peso hoy.`)
  }

  const sore = r.entry && (r.entry.soreness ?? 0) >= 3 ? r.entry.soreAreas ?? [] : []
  for (const m of sore) adj.muscleSetDelta[m] = -1
  if (sore.length) note('SORENESS', `Dolor muscular en ${sore.join(', ')}: −1 serie en esos grupos.`)

  // Combate: el tren inferior se modera antes y después de sesiones exigentes
  const tomorrow = demandingCombatTomorrow(ctx.plan, now)
  if (tomorrow) {
    adj.lowerSetDelta -= 1; adj.lowerWeightFactor = T.COMBAT_PROXIMITY_LOAD; adj.holdLower = true
    note('COMBAT_TOMORROW', `Mañana hay combate${tomorrow.combat?.sparring ? ' con sparring' : ' intenso'}: piernas con −1 serie, ≈−5 % de carga, sin llegar al fallo y sin subir peso.`)
  }
  const recent = recentDemandingCombat(ctx.activities, now)
  if (recent) {
    adj.lowerSetDelta -= 1; adj.lowerWeightFactor = Math.min(adj.lowerWeightFactor, T.COMBAT_PROXIMITY_LOAD); adj.holdLower = true
    note('COMBAT_RECENT', `${recent.sport} exigente reciente (RPE ${recent.rpe}${recent.sparring ? ', con sparring' : ''}): piernas −1 serie y sin subir peso.`)
  }

  const streak = consecutiveHardDays(ctx.sessions, ctx.activities, now)
  if (streak >= 2) {
    adj.suggestRecoveryDay = true
    note('HARD_STREAK', `Llevas ${streak} días duros seguidos: hoy mejor recuperación activa o una sesión ligera.`)
  }

  adj.active = adj.deload || adj.weightFactor < 1 || adj.setDelta < 0 || adj.lowerSetDelta < 0 || Object.keys(adj.muscleSetDelta).length > 0 || adj.holdLower || adj.holdAll
  return adj
}

