import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Tab = 'home' | 'gym' | 'combat' | 'philosophy' | 'profile'

/** Rutas con prefijo de módulo: cada módulo solo renderiza las suyas (ver App.tsx). */
export type Screen =
  // GYM
  | { name: 'gym.routine'; id: string }
  | { name: 'gym.editRoutine'; id: string }
  | { name: 'gym.import' }
  | { name: 'gym.exercise'; id: string }
  | { name: 'gym.session'; id: string }
  | { name: 'gym.summary'; id: string }
  | { name: 'gym.loads'; key: string }
  // COMBAT
  | { name: 'combat.technique'; sport: string; id: string }
  | { name: 'combat.training'; sport: string; id: string }
  | { name: 'combat.import' }
  // FILOSOFÍA
  | { name: 'philo.philosopher'; id: string }
  | { name: 'philo.reflection'; id: string }
  | { name: 'philo.pillar'; id: string }
  | { name: 'philo.entry'; id: string }
  // Compartidas (perfil / recuperación global)
  | { name: 'shared.week' }
  | { name: 'shared.mobility' }
  | { name: 'profile.hybridImport' }
  | { name: 'profile.progress' }

interface Nav {
  tab: Tab
  stack: Screen[]
  /** Subsección seleccionada dentro de cada pestaña (cada pestaña tiene su propia navegación interna) */
  sub: Partial<Record<Tab, string>>
  setTab: (t: Tab) => void
  setSub: (t: Tab, key: string) => void
  /** Cambia de pestaña (y subsección) desde otra: solo navegación, sin ejecutar funciones del destino */
  go: (t: Tab, sub?: string) => void
  push: (s: Screen) => void
  pop: () => void
  replace: (s: Screen) => void
  reset: () => void
}

const Ctx = createContext<Nav>(null as unknown as Nav)
export const useNav = () => useContext(Ctx)

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('home')
  const [stack, setStack] = useState<Screen[]>([])
  const [sub, setSubState] = useState<Partial<Record<Tab, string>>>({})
  const setTab = useCallback((t: Tab) => { setStack([]); setTabState(t) }, [])
  const setSub = useCallback((t: Tab, key: string) => setSubState((cur) => ({ ...cur, [t]: key })), [])
  const go = useCallback((t: Tab, s?: string) => { setStack([]); setTabState(t); if (s) setSubState((cur) => ({ ...cur, [t]: s })) }, [])
  const push = useCallback((s: Screen) => setStack((cur) => [...cur, s]), [])
  const pop = useCallback(() => setStack((cur) => cur.slice(0, -1)), [])
  const replace = useCallback((s: Screen) => setStack((cur) => [...cur.slice(0, -1), s]), [])
  const reset = useCallback(() => setStack([]), [])
  return <Ctx.Provider value={{ tab, stack, sub, setTab, setSub, go, push, pop, replace, reset }}>{children}</Ctx.Provider>
}
