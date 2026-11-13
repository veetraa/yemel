/**
 * Store raíz. Solo gestiona lo COMPARTIDO: perfil, recuperación, medidas, carga global y las dos
 * fuentes de entrenamiento que alimentan el motor (gimnasio: rutinas/sesiones; combate: plan/actividades).
 * Filosofía y los vídeos de Combat tienen sus propios proveedores.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dbAll, dbClearAll, dbClearCore, dbDelete, dbGet, dbPut, requestPersistence, type StoreName } from './shared/lib/db'
import { backupContributors } from './shared/lib/backupRegistry'
import { setCustomExercises, type Exercise } from './modules/gym/data/exercises'
import { uid } from './shared/lib/utils'
import { fitToTime, buildWorkout, defaultHybridRoutine, activeRoutine } from './modules/gym/services/workoutService'
import { planAdjustment, type Adjustment } from './shared/services/adjustmentService'
import { DEFAULT_REST_DAYS, composeWeek, defaultCombatPlan, migrateLegacyPlan, tryAssignGymDays, tryChangeCombat, tryChangeRestDays, type PlanIssue } from './shared/services/planningService'
import { currentWeight, DEFAULT_PROFILE, DEFAULT_SETTINGS, migrateLegacy, migrateProfile } from './shared/services/profileService'
import { endDeload, snoozeDeload, startDeload } from './shared/services/recoveryService'
import { mergeById, parseBackup, type AppliedBundle } from './shared/services/hybridImportService'
import type { Activity, ActiveWorkout, BackupFile, BodyEntry, CombatPlan, EngineCtx, Profile, Routine, RoutineDay, Session, Settings, WeekPlan, Wellness } from './types'

export { DEFAULT_SETTINGS }

export interface StartOpts {
  /** Aplicar ajuste por recuperación/carga (por defecto, el ajuste de Perfil) */
  adapt?: boolean
  /** Acortar el día para que quepa en estos minutos */
  fitMinutes?: number
}

export type WeekResult = { ok: boolean; issues: PlanIssue[] }

interface Store {
  ready: boolean
  settings: Settings
  profile: Profile
  routines: Routine[]
  sessions: Session[]
  body: BodyEntry[]
  wellness: Wellness[]
  /** Registro de entrenamiento fuera del gimnasio (combate, movilidad…) */
  activities: Activity[]
  combatPlan: CombatPlan
  customExercises: Exercise[]
  active: ActiveWorkout | null
  toast: string | null
  /** Peso corporal actual (última medición o dato del perfil) */
  weight?: number
  /** Rutina de gimnasio activa */
  planRoutine?: Routine
  /** Semana DERIVADA (gym + combat + recuperación). No se guarda. */
  plan: WeekPlan
  /** Contexto con el que los servicios analizan al atleta */
  ctx: EngineCtx
  adjustment: Adjustment
  showToast: (m: string) => void
  updateSettings: (p: Partial<Settings>) => void
  updateProfile: (p: Partial<Profile>) => void
  setCurrentWeight: (kg: number | undefined) => void
  saveBody: (e: BodyEntry) => void
  deleteBody: (id: string) => void
  saveWellness: (w: Wellness) => void
  deleteWellness: (id: string) => void
  addActivity: (a: Omit<Activity, 'id'>) => void
  deleteActivity: (id: string) => void
  updateSession: (id: string, p: Partial<Session>) => void
  saveRoutine: (r: Routine) => void
  deleteRoutine: (id: string) => void
  /** GYM: días de la semana de un día de rutina (solo si respeta las reglas de recuperación) */
  setGymDays: (dayId: string, weekdays: number[]) => WeekResult
  /** COMBAT: cambia sus sesiones planificadas (solo si respeta las reglas de recuperación) */
  changeCombatPlan: (fn: (c: CombatPlan) => CombatPlan) => WeekResult
  /** Recuperación global: días de descanso completo */
  setRestDays: (days: number[]) => WeekResult
  /** Restaura gimnasio (días), combate y descansos a la configuración del propietario */
  resetWeek: () => void
  applyImport: (a: AppliedBundle) => void
  deloadAction: (a: 'start' | 'end' | 'snooze') => void
  startWorkout: (routine: Routine | undefined, day: RoutineDay | undefined, opts?: StartOpts) => void
  updateActive: (fn: (a: ActiveWorkout) => ActiveWorkout) => void
  finishWorkout: () => Session | null
  cancelWorkout: () => void
  deleteSession: (id: string) => void
  exportBackup: () => BackupFile
  importBackup: (text: string, mode: 'merge' | 'replace') => { ok: boolean; message: string }
  resetAll: () => Promise<void>
}

const Ctx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(Ctx)

const byTsDesc = <T extends { ts: number }>(a: T, b: T) => b.ts - a.ts
const byIdDesc = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? 1 : -1)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [body, setBody] = useState<BodyEntry[]>([])
  const [wellness, setWellness] = useState<Wellness[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [combatPlan, setCombatPlan] = useState<CombatPlan>(() => defaultCombatPlan())
  const [customs, setCustoms] = useState<Exercise[]>([])
  const [active, setActive] = useState<ActiveWorkout | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>(0)

  useEffect(() => {
    ;(async () => {
      const [s, p, r, ss, a, b, w, ac, cp, legacy, cx] = await Promise.all([
        dbGet<Record<string, unknown>>('kv', 'settings'), dbGet<Profile>('kv', 'profile'), dbAll<Routine>('routines'), dbAll<Session>('sessions'),
        dbGet<ActiveWorkout>('kv', 'active'), dbAll<BodyEntry>('body'), dbAll<Wellness>('wellness'), dbAll<Activity>('activities'),
        dbGet<CombatPlan>('kv', 'combatPlan'), dbGet<WeekPlan>('kv', 'plan'), dbGet<Exercise[]>('kv', 'customExercises'),
      ])
      setCustomExercises(cx ?? [])
      setCustoms(cx ?? [])
      let st = { ...DEFAULT_SETTINGS, ...(s as Partial<Settings>) }
      let prof: Profile
      if (p) {
        prof = migrateProfile({ ...DEFAULT_PROFILE, ...p } as Profile)
        if (prof !== p) void dbPut('kv', 'profile', prof)
      } else {
        prof = migrateLegacy(s)
        void dbPut('kv', 'profile', prof)
      }
      let routs = r
      let cplan = cp
      if (!cplan) {
        if (legacy) {
          // Versión anterior: la semana mezclada se reparte en datos propios de cada dominio
          const m = migrateLegacyPlan(legacy)
          cplan = m.combat
          prof = { ...prof, restDays: m.restDays.length ? m.restDays : DEFAULT_REST_DAYS }
          void dbPut('kv', 'profile', prof)
          void dbDelete('kv', 'plan')
        } else {
          let hr = routs.find((x) => x.id === 'hybrid-default')
          if (!hr) { hr = defaultHybridRoutine(); routs = [hr, ...routs]; void dbPut('routines', hr.id, hr) }
          cplan = defaultCombatPlan()
          st = { ...st, activeRoutineId: hr.id }
          void dbPut('kv', 'settings', st)
        }
        void dbPut('kv', 'combatPlan', cplan)
      }
      setSettings(st)
      setProfile(prof)
      setCombatPlan(cplan)
      setRoutines(routs.sort((x, y) => y.updatedAt - x.updatedAt))
      setSessions(ss.sort((x, y) => y.endedAt - x.endedAt))
      setBody(b.sort(byTsDesc))
      setWellness(w.sort(byIdDesc))
      setActivities(ac.sort(byTsDesc))
      if (a) setActive(a)
      setReady(true)
      void requestPersistence()
    })()
  }, [])

  const showToast = useCallback((m: string) => {
    setToast(m)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((cur) => { const n = { ...cur, ...p }; void dbPut('kv', 'settings', n); return n })
  }, [])

  const updateProfile = useCallback((p: Partial<Profile>) => {
    setProfile((cur) => { const n = { ...cur, ...p }; void dbPut('kv', 'profile', n); return n })
  }, [])

  // ── Historial corporal ──
  const syncWeight = useCallback((entries: BodyEntry[]) => {
    const w = entries.filter((e) => typeof e.weight === 'number').sort(byTsDesc)[0]?.weight
    if (w !== undefined) setProfile((cur) => { if (cur.weightKg === w) return cur; const n = { ...cur, weightKg: w }; void dbPut('kv', 'profile', n); return n })
  }, [])

  const saveBody = useCallback((e: BodyEntry) => {
    void dbPut('body', e.id, e)
    setBody((cur) => { const n = [e, ...cur.filter((x) => x.id !== e.id)].sort(byTsDesc); syncWeight(n); return n })
  }, [syncWeight])

  const deleteBody = useCallback((id: string) => {
    void dbDelete('body', id)
    setBody((cur) => { const n = cur.filter((x) => x.id !== id); syncWeight(n); return n })
  }, [syncWeight])

  const setCurrentWeight = useCallback((kg: number | undefined) => {
    if (kg === undefined) return updateProfile({ weightKg: undefined })
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const existing = body.find((b) => b.ts >= start.getTime() && typeof b.weight === 'number') ?? body.find((b) => b.ts >= start.getTime())
    saveBody({ ...(existing ?? { id: uid(), ts: Date.now() }), weight: kg })
  }, [body, saveBody, updateProfile])

  const saveWellness = useCallback((w: Wellness) => {
    void dbPut('wellness', w.id, w)
    setWellness((cur) => [w, ...cur.filter((x) => x.id !== w.id)].sort(byIdDesc))
  }, [])
  const deleteWellness = useCallback((id: string) => {
    void dbDelete('wellness', id)
    setWellness((cur) => cur.filter((x) => x.id !== id))
  }, [])

  const addActivity = useCallback((a: Omit<Activity, 'id'>) => {
    const n = { ...a, id: uid() }
    void dbPut('activities', n.id, n)
    setActivities((cur) => [n, ...cur].sort(byTsDesc))
  }, [])
  const deleteActivity = useCallback((id: string) => {
    void dbDelete('activities', id)
    setActivities((cur) => cur.filter((x) => x.id !== id))
  }, [])

  // ── Rutinas (GYM) ──
  const saveRoutine = useCallback((r: Routine) => {
    const n = { ...r, updatedAt: Date.now() }
    void dbPut('routines', n.id, n)
    setRoutines((cur) => [n, ...cur.filter((x) => x.id !== n.id)])
    setSettings((cur) => {
      if (cur.activeRoutineId) return cur
      const s = { ...cur, activeRoutineId: n.id }
      void dbPut('kv', 'settings', s)
      return s
    })
  }, [])

  const deleteRoutine = useCallback((id: string) => {
    void dbDelete('routines', id)
    setRoutines((cur) => cur.filter((x) => x.id !== id))
    setSettings((cur) => {
      if (cur.activeRoutineId !== id) return cur
      const s = { ...cur, activeRoutineId: undefined }
      void dbPut('kv', 'settings', s)
      return s
    })
  }, [])

  const weight = useMemo(() => currentWeight(profile, body), [profile, body])
  const planRoutine = useMemo(() => activeRoutine(routines, settings), [routines, settings])
  const plan = useMemo(() => composeWeek(planRoutine, combatPlan, profile), [planRoutine, combatPlan, profile])
  const ctx = useMemo<EngineCtx>(() => ({ profile: { ...profile, weightKg: weight }, sessions, activities, wellness, plan, routine: planRoutine }), [profile, weight, sessions, activities, wellness, plan, planRoutine])
  const adjustment = useMemo(() => planAdjustment(ctx), [ctx])

  // ── Semana: cada dominio edita lo suyo, validado contra las reglas globales de recuperación ──
  const persistCombat = useCallback((c: CombatPlan) => { setCombatPlan(c); void dbPut('kv', 'combatPlan', c) }, [])

  const setGymDays = useCallback((dayId: string, weekdays: number[]): WeekResult => {
    if (!planRoutine) return { ok: false, issues: [] }
    const r = tryAssignGymDays(planRoutine, dayId, weekdays, combatPlan, profile)
    if (r.ok) saveRoutine(r.routine)
    return { ok: r.ok, issues: r.issues }
  }, [planRoutine, combatPlan, profile, saveRoutine])

  const changeCombatPlan = useCallback((fn: (c: CombatPlan) => CombatPlan): WeekResult => {
    const cand = { ...fn(combatPlan), updatedAt: Date.now() }
    const r = tryChangeCombat(combatPlan, cand, planRoutine, profile)
    if (r.ok) persistCombat(r.combat)
    return { ok: r.ok, issues: r.issues }
  }, [combatPlan, planRoutine, profile, persistCombat])

  const setRestDays = useCallback((days: number[]): WeekResult => {
    const r = tryChangeRestDays(days, planRoutine, combatPlan, profile)
    if (r.ok) updateProfile({ restDays: days })
    return { ok: r.ok, issues: r.issues }
  }, [planRoutine, combatPlan, profile, updateProfile])

  const resetWeek = useCallback(() => {
    let hr = routines.find((r) => r.id === 'hybrid-default')
    const fresh = defaultHybridRoutine()
    if (!hr) { hr = fresh; setRoutines((cur) => [fresh, ...cur]) } else hr = { ...hr, days: hr.days.map((d) => ({ ...d, weekdays: fresh.days.find((x) => x.id === d.id)?.weekdays ?? [] })) }
    void dbPut('routines', hr.id, hr)
    const final = hr
    setRoutines((cur) => [final, ...cur.filter((x) => x.id !== final.id)])
    persistCombat(defaultCombatPlan())
    updateProfile({ restDays: DEFAULT_REST_DAYS })
    updateSettings({ activeRoutineId: final.id })
  }, [routines, persistCombat, updateProfile, updateSettings])

  const applyImport = useCallback((a: AppliedBundle) => {
    if (a.customExercises.length) {
      setCustoms((cur) => {
        const merged = [...a.customExercises, ...cur.filter((c) => !a.customExercises.some((x) => x.id === c.id))]
        setCustomExercises(merged)
        void dbPut('kv', 'customExercises', merged)
        return merged
      })
    }
    if (a.routine) {
      const r = { ...a.routine, updatedAt: Date.now() }
      void dbPut('routines', r.id, r)
      setRoutines((cur) => [r, ...cur.filter((x) => x.id !== r.id)])
      updateSettings({ activeRoutineId: r.id })
    }
    if (a.combatPlan) persistCombat({ ...a.combatPlan, updatedAt: Date.now() })
    if (a.profilePatch) updateProfile(a.profilePatch)
  }, [persistCombat, updateSettings, updateProfile])

  const deloadAction = useCallback((act: 'start' | 'end' | 'snooze') => {
    updateProfile(act === 'start' ? startDeload() : act === 'end' ? endDeload() : snoozeDeload())
  }, [updateProfile])

  const persistActive = (a: ActiveWorkout | null) => {
    if (a) void dbPut('kv', 'active', a)
    else void dbDelete('kv', 'active')
  }

  const startWorkout = useCallback((routine: Routine | undefined, day: RoutineDay | undefined, opts: StartOpts = {}) => {
    const adapt = opts.adapt ?? settings.adaptToRecovery
    const adj = adapt && adjustment.active ? adjustment : undefined
    let d = day
    const notes: string[] = []
    if (d && opts.fitMinutes) {
      const f = fitToTime(d, opts.fitMinutes)
      d = f.day
      if (f.removedSets || f.removedExercises) notes.push(`Acortado a ${opts.fitMinutes} min: ${f.removedSets} series y ${f.removedExercises} ejercicios menos.`)
    }
    if (adj) notes.push(...adj.notes)
    const built = buildWorkout(d, ctx, adj)
    notes.push(...built.notes)
    const a: ActiveWorkout = {
      id: uid(), routineId: routine?.id, routineName: routine?.name ?? 'Entrenamiento libre',
      dayName: day?.name ?? 'Sesión libre', startedAt: Date.now(),
      exercises: built.logs, index: 0, adjustNotes: notes.length ? notes : undefined,
    }
    setActive(a)
    persistActive(a)
  }, [settings.adaptToRecovery, adjustment, ctx])

  const updateActive = useCallback((fn: (a: ActiveWorkout) => ActiveWorkout) => {
    setActive((cur) => {
      if (!cur) return cur
      const n = fn(cur)
      persistActive(n)
      return n
    })
  }, [])

  const finishWorkout = useCallback((): Session | null => {
    if (!active) return null
    const exercises = active.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length)
    const s: Session = {
      id: active.id, routineId: active.routineId, routineName: active.routineName, dayName: active.dayName,
      startedAt: active.startedAt, endedAt: Date.now(), exercises,
    }
    setActive(null)
    persistActive(null)
    if (!exercises.length) return null
    void dbPut('sessions', s.id, s)
    setSessions((cur) => [s, ...cur])
    return s
  }, [active])

  const updateSession = useCallback((id: string, p: Partial<Session>) => {
    setSessions((cur) => cur.map((s) => {
      if (s.id !== id) return s
      const n = { ...s, ...p }
      void dbPut('sessions', n.id, n)
      return n
    }))
  }, [])

  const cancelWorkout = useCallback(() => { setActive(null); persistActive(null) }, [])

  const deleteSession = useCallback((id: string) => {
    void dbDelete('sessions', id)
    setSessions((cur) => cur.filter((s) => s.id !== id))
  }, [])

  const exportBackup = useCallback((): BackupFile => {
    const out: BackupFile = {
      app: 'forma', version: 4, exportedAt: new Date().toISOString(), settings, profile, routines, sessions, body, wellness, activities, combatPlan, customExercises: customs,
    }
    for (const c of backupContributors()) (out as unknown as Record<string, unknown>)[c.key] = c.export()
    return out
  }, [settings, profile, routines, sessions, body, wellness, activities, combatPlan, customs])

  const importBackup = useCallback((text: string, mode: 'merge' | 'replace') => {
    const parsed = parseBackup(text)
    if (!parsed.ok) return parsed
    const data = parsed.data
    const mergedR = mergeById(data.routines, routines, mode)
    const mergedS = mergeById(data.sessions, sessions, mode).sort((a, b) => b.endedAt - a.endedAt)
    const mergedB = mergeById(data.body, body, mode).sort(byTsDesc)
    const mergedW = mergeById(data.wellness, wellness, mode).sort(byIdDesc)
    const mergedA = mergeById(data.activities, activities, mode).sort(byTsDesc)
    const mergedC = mergeById((data.customExercises ?? []) as Exercise[], customs, mode)
    // v3 guardaba una semana mezclada: se reparte en datos propios de cada dominio
    const legacy = data.plan ? migrateLegacyPlan(data.plan) : undefined
    let newProfile: Profile | undefined = mode === 'replace'
      ? data.profile ? migrateProfile({ ...DEFAULT_PROFILE, ...data.profile } as Profile) : migrateLegacy(data.settings as unknown as Record<string, unknown>)
      : !profile.name && data.profile ? migrateProfile({ ...DEFAULT_PROFILE, ...data.profile } as Profile) : undefined
    if (legacy && newProfile && !data.combatPlan) newProfile = { ...newProfile, restDays: legacy.restDays.length ? legacy.restDays : DEFAULT_REST_DAYS }
    const newCombat = mode === 'replace' ? data.combatPlan ?? legacy?.combat : undefined
    const newSettings = mode === 'replace' && data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : undefined
    void (async () => {
      if (mode === 'replace') await dbClearCore()
      const put = <T extends { id: string }>(store: StoreName, items: T[]) => Promise.all(items.map((x) => dbPut(store, x.id, x)))
      await Promise.all([put('routines', mergedR), put('sessions', mergedS), put('body', mergedB), put('wellness', mergedW), put('activities', mergedA)])
      await dbPut('kv', 'customExercises', mergedC)
      await dbPut('kv', 'profile', newProfile ?? profile)
      await dbPut('kv', 'settings', newSettings ?? settings)
      await dbPut('kv', 'combatPlan', newCombat ?? combatPlan)
    })()
    for (const c of backupContributors()) { const d = (data as unknown as Record<string, unknown>)[c.key]; if (d !== undefined || mode === 'replace') c.import(d, mode) }
    setRoutines(mergedR); setSessions(mergedS); setBody(mergedB); setWellness(mergedW); setActivities(mergedA)
    setCustoms(mergedC); setCustomExercises(mergedC)
    if (newProfile) setProfile(newProfile)
    if (newSettings) setSettings(newSettings)
    if (newCombat) setCombatPlan(newCombat)
    if (mode === 'replace') setActive(null)
    return { ok: true, message: `Importadas ${data.routines.length} rutinas y ${data.sessions.length} sesiones${data.profile ? ' (con perfil)' : ''}.` }
  }, [routines, sessions, body, wellness, activities, customs, profile, settings, combatPlan])

  /** Vuelve a la configuración de fábrica del propietario (perfil híbrido + semana + rutina GYM A/B/C) */
  const resetAll = useCallback(async () => {
    await dbClearAll()
    for (const c of backupContributors()) await c.reset()
    const hr = defaultHybridRoutine()
    const cp = defaultCombatPlan()
    const st = { ...DEFAULT_SETTINGS, activeRoutineId: hr.id }
    await Promise.all([dbPut('routines', hr.id, hr), dbPut('kv', 'combatPlan', cp), dbPut('kv', 'settings', st), dbPut('kv', 'profile', DEFAULT_PROFILE)])
    setCustomExercises([])
    setCustoms([]); setRoutines([hr]); setSessions([]); setBody([]); setWellness([]); setActivities([]); setActive(null)
    setSettings(st); setProfile(DEFAULT_PROFILE); setCombatPlan(cp)
  }, [])

  const value = useMemo<Store>(() => ({
    ready, settings, profile, routines, sessions, body, wellness, activities, combatPlan, customExercises: customs, active, toast, weight, planRoutine, plan, ctx, adjustment,
    showToast, updateSettings, updateProfile, setCurrentWeight, saveBody, deleteBody, saveWellness, deleteWellness, addActivity, deleteActivity, updateSession,
    saveRoutine, deleteRoutine, setGymDays, changeCombatPlan, setRestDays, resetWeek, applyImport, deloadAction, startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll,
  }), [ready, settings, profile, routines, sessions, body, wellness, activities, combatPlan, customs, active, toast, weight, planRoutine, plan, ctx, adjustment, showToast, updateSettings, updateProfile, setCurrentWeight, saveBody, deleteBody, saveWellness, deleteWellness, addActivity, deleteActivity, updateSession, saveRoutine, deleteRoutine, setGymDays, changeCombatPlan, setRestDays, resetWeek, applyImport, deloadAction, startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
