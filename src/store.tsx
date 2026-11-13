import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dbAll, dbClearAll, dbDelete, dbGet, dbPut, requestPersistence, type StoreName } from './lib/db'
import { setCustomExercises, type Exercise } from './data/exercises'
import { uid } from './lib/utils'
import { fitToTime, buildWorkout, defaultHybridRoutine, activeRoutine } from './services/workoutService'
import { planAdjustment, type Adjustment } from './services/progressionService'
import { applyIfValid, buildDefaultPlan, syncRoutineWeekdays, type PlanIssue } from './services/planningService'
import { currentWeight, DEFAULT_PROFILE, DEFAULT_SETTINGS, migrateLegacy, migrateProfile } from './services/profileService'
import { endDeload, snoozeDeload, startDeload } from './services/recoveryService'
import { mergeById, parseBackup, type AppliedBundle } from './services/importExportService'
import type { Activity, ActiveWorkout, BackupFile, BodyEntry, EngineCtx, Profile, Routine, RoutineDay, Session, Settings, Wellness, WeekPlan } from './types'

export { DEFAULT_SETTINGS }

export interface StartOpts {
  /** Aplicar ajuste por recuperación/carga (por defecto, el ajuste de Perfil) */
  adapt?: boolean
  /** Acortar el día para que quepa en estos minutos */
  fitMinutes?: number
}

interface Store {
  ready: boolean
  settings: Settings
  profile: Profile
  routines: Routine[]
  sessions: Session[]
  body: BodyEntry[]
  wellness: Wellness[]
  activities: Activity[]
  plan: WeekPlan
  customExercises: Exercise[]
  active: ActiveWorkout | null
  toast: string | null
  /** Peso corporal actual (última medición o dato del perfil) */
  weight?: number
  /** Rutina enlazada con el plan semanal */
  planRoutine?: Routine
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
  /** Cambia el plan solo si respeta las reglas de recuperación */
  changePlan: (fn: (p: WeekPlan) => WeekPlan) => { ok: boolean; issues: PlanIssue[] }
  resetPlan: () => void
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
  const [plan, setPlan] = useState<WeekPlan>(() => buildDefaultPlan())
  const [customs, setCustoms] = useState<Exercise[]>([])
  const [active, setActive] = useState<ActiveWorkout | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>(0)

  useEffect(() => {
    ;(async () => {
      const [s, p, r, ss, a, b, w, ac, pl, cx] = await Promise.all([
        dbGet<Record<string, unknown>>('kv', 'settings'), dbGet<Profile>('kv', 'profile'), dbAll<Routine>('routines'), dbAll<Session>('sessions'),
        dbGet<ActiveWorkout>('kv', 'active'), dbAll<BodyEntry>('body'), dbAll<Wellness>('wellness'), dbAll<Activity>('activities'),
        dbGet<WeekPlan>('kv', 'plan'), dbGet<Exercise[]>('kv', 'customExercises'),
      ])
      setCustomExercises(cx ?? [])
      setCustoms(cx ?? [])
      let st = { ...DEFAULT_SETTINGS, ...(s as Partial<Settings>) }
      let prof: Profile
      if (p) {
        prof = migrateProfile({ ...DEFAULT_PROFILE, ...p } as Profile)
        if (prof !== p && !p.athleteType) void dbPut('kv', 'profile', prof)
      } else {
        prof = migrateLegacy(s)
        void dbPut('kv', 'profile', prof)
      }
      let routs = r
      let planV = pl
      if (!planV) {
        // Primera ejecución con planificación: se siembra la configuración híbrida del propietario
        let hr = routs.find((x) => x.id === 'hybrid-default')
        if (!hr) { hr = defaultHybridRoutine(); routs = [hr, ...routs]; void dbPut('routines', hr.id, hr) }
        planV = buildDefaultPlan(hr)
        void dbPut('kv', 'plan', planV)
        st = { ...st, activeRoutineId: hr.id }
        void dbPut('kv', 'settings', st)
      }
      setSettings(st)
      setProfile(prof)
      setPlan(planV)
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

  // ── Rutinas ──
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
    // Las franjas de gimnasio enlazadas a esa rutina se desenlazan
    setPlan((cur) => {
      if (cur.routineId !== id) return cur
      const n = { ...cur, routineId: undefined, slots: cur.slots.map((s) => ({ ...s, routineDayId: undefined })) }
      void dbPut('kv', 'plan', n)
      return n
    })
  }, [])

  const weight = useMemo(() => currentWeight(profile, body), [profile, body])
  const planRoutine = useMemo(() => routines.find((r) => r.id === plan.routineId) ?? activeRoutine(routines, settings), [routines, plan.routineId, settings])
  const ctx = useMemo<EngineCtx>(() => ({ profile: { ...profile, weightKg: weight }, sessions, activities, wellness, plan, routine: planRoutine }), [profile, weight, sessions, activities, wellness, plan, planRoutine])
  const adjustment = useMemo(() => planAdjustment(ctx), [ctx])

  // ── Plan semanal ──
  const persistPlan = useCallback((p: WeekPlan, routine?: Routine) => {
    setPlan(p)
    void dbPut('kv', 'plan', p)
    if (routine) {
      const synced = syncRoutineWeekdays(routine, p)
      void dbPut('routines', synced.id, synced)
      setRoutines((cur) => cur.map((r) => (r.id === synced.id ? synced : r)))
    }
  }, [])

  const changePlan = useCallback((fn: (p: WeekPlan) => WeekPlan) => {
    const candidate = fn(plan)
    const res = applyIfValid(plan, candidate, profile, planRoutine)
    if (res.ok) persistPlan(res.plan, planRoutine)
    return { ok: res.ok, issues: res.issues }
  }, [plan, profile, planRoutine, persistPlan])

  const resetPlan = useCallback(() => {
    let hr = routines.find((r) => r.id === 'hybrid-default')
    if (!hr) { hr = defaultHybridRoutine(); void dbPut('routines', hr.id, hr); setRoutines((cur) => [hr!, ...cur]) }
    persistPlan(buildDefaultPlan(hr), hr)
    updateSettings({ activeRoutineId: hr.id })
  }, [routines, persistPlan, updateSettings])

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
    if (a.plan) persistPlan({ ...a.plan, routineId: a.routine?.id ?? a.plan.routineId, updatedAt: Date.now() })
    if (a.profilePatch) updateProfile(a.profilePatch)
  }, [persistPlan, updateSettings, updateProfile])

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

  const exportBackup = useCallback((): BackupFile => ({
    app: 'forma', version: 3, exportedAt: new Date().toISOString(), settings, profile, routines, sessions, body, wellness, activities, plan, customExercises: customs,
  }), [settings, profile, routines, sessions, body, wellness, activities, plan, customs])

  const importBackup = useCallback((text: string, mode: 'merge' | 'replace') => {
    const parsed = parseBackup(text)
    if (!parsed.ok) return parsed
    const data = parsed.data
    const mergedR = mergeById(data.routines, routines, mode)
    const mergedS = mergeById(data.sessions, sessions, mode).sort((a, b) => b.endedAt - a.endedAt)
    const mergedB = mergeById(data.body, body, mode).sort(byTsDesc)
    const mergedW = mergeById(data.wellness, wellness, mode).sort(byIdDesc)
    const mergedA = mergeById(data.activities, activities, mode).sort(byTsDesc)
    const incomingCx = (data.customExercises ?? []) as Exercise[]
    const mergedC = mergeById(incomingCx, customs, mode)
    // Merge: se conserva el perfil/plan actual salvo que esté vacío; replace: se usa el de la copia
    const newProfile: Profile | undefined = mode === 'replace'
      ? data.profile ? migrateProfile({ ...DEFAULT_PROFILE, ...data.profile } as Profile) : migrateLegacy(data.settings as unknown as Record<string, unknown>)
      : !profile.name && data.profile ? migrateProfile({ ...DEFAULT_PROFILE, ...data.profile } as Profile) : undefined
    const newSettings = mode === 'replace' && data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : undefined
    const newPlan = mode === 'replace' ? data.plan : undefined
    void (async () => {
      if (mode === 'replace') await dbClearAll()
      const put = <T extends { id: string }>(store: StoreName, items: T[]) => Promise.all(items.map((x) => dbPut(store, x.id, x)))
      await Promise.all([put('routines', mergedR), put('sessions', mergedS), put('body', mergedB), put('wellness', mergedW), put('activities', mergedA)])
      await dbPut('kv', 'customExercises', mergedC)
      if (newProfile) await dbPut('kv', 'profile', newProfile)
      else if (mode === 'replace') await dbPut('kv', 'profile', profile)
      if (newSettings) await dbPut('kv', 'settings', newSettings)
      else if (mode === 'replace') await dbPut('kv', 'settings', settings)
      await dbPut('kv', 'plan', newPlan ?? plan)
    })()
    setRoutines(mergedR); setSessions(mergedS); setBody(mergedB); setWellness(mergedW); setActivities(mergedA)
    setCustoms(mergedC); setCustomExercises(mergedC)
    if (newProfile) setProfile(newProfile)
    if (newSettings) setSettings(newSettings)
    if (newPlan) setPlan(newPlan)
    if (mode === 'replace') setActive(null)
    return { ok: true, message: `Importadas ${data.routines.length} rutinas y ${data.sessions.length} sesiones${data.profile ? ' (con perfil)' : ''}.` }
  }, [routines, sessions, body, wellness, activities, customs, profile, settings, plan])

  /** Vuelve a la configuración de fábrica del propietario (perfil híbrido + plan + rutina GYM A/B/C) */
  const resetAll = useCallback(async () => {
    await dbClearAll()
    const hr = defaultHybridRoutine()
    const pl = buildDefaultPlan(hr)
    const st = { ...DEFAULT_SETTINGS, activeRoutineId: hr.id }
    await Promise.all([dbPut('routines', hr.id, hr), dbPut('kv', 'plan', pl), dbPut('kv', 'settings', st), dbPut('kv', 'profile', DEFAULT_PROFILE)])
    setCustomExercises([])
    setCustoms([]); setRoutines([hr]); setSessions([]); setBody([]); setWellness([]); setActivities([]); setActive(null)
    setSettings(st); setProfile(DEFAULT_PROFILE); setPlan(pl)
  }, [])

  const value = useMemo<Store>(() => ({
    ready, settings, profile, routines, sessions, body, wellness, activities, plan, customExercises: customs, active, toast, weight, planRoutine, ctx, adjustment,
    showToast, updateSettings, updateProfile, setCurrentWeight, saveBody, deleteBody, saveWellness, deleteWellness, addActivity, deleteActivity, updateSession,
    saveRoutine, deleteRoutine, changePlan, resetPlan, applyImport, deloadAction, startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll,
  }), [ready, settings, profile, routines, sessions, body, wellness, activities, plan, customs, active, toast, weight, planRoutine, ctx, adjustment, showToast, updateSettings, updateProfile, setCurrentWeight, saveBody, deleteBody, saveWellness, deleteWellness, addActivity, deleteActivity, updateSession, saveRoutine, deleteRoutine, changePlan, resetPlan, applyImport, deloadAction, startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
