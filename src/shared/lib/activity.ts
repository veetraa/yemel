/**
 * Predicados sobre el registro genérico de actividad (`Activity`). Los usa el motor global de carga
 * (fatiga, planificación) sin depender del módulo COMBAT.
 */
import type { Activity } from '../../types'
import { T } from '../services/principlesService'

/** Nombres de deporte que cuentan como combate (para registros sin `kind`) */
export const COMBAT_SPORT_NAMES = ['MMA', 'Brazilian Jiu-Jitsu', 'Boxeo', 'Kickboxing', 'Wrestling', 'Jiu-Jitsu', 'Grappling', 'Muay Thai', 'Striking']

export const isCombatSport = (sport: string) => COMBAT_SPORT_NAMES.includes(sport)
export const hasCombatSport = (sports: string[]) => sports.some(isCombatSport)
export const isCombat = (a: Activity) => a.kind === 'combat' || (!a.kind && isCombatSport(a.sport))

/** Sesión exigente: RPE alto o sparring (no se asume: depende de lo registrado) */
export const isDemanding = (a: Pick<Activity, 'rpe' | 'sparring'>) => a.rpe >= T.HARD_RPE || !!a.sparring
