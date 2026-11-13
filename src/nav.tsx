import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Tab = 'home' | 'routines' | 'train' | 'progress' | 'profile'
export type Screen =
  | { name: 'routine'; id: string }
  | { name: 'editRoutine'; id: string }
  | { name: 'import' }
  | { name: 'library' }
  | { name: 'exercise'; id: string }
  | { name: 'session'; id: string }
  | { name: 'summary'; id: string }
  | { name: 'plan' }
  | { name: 'mobility' }

interface Nav {
  tab: Tab
  stack: Screen[]
  setTab: (t: Tab) => void
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
  const setTab = useCallback((t: Tab) => { setStack([]); setTabState(t) }, [])
  const push = useCallback((s: Screen) => setStack((cur) => [...cur, s]), [])
  const pop = useCallback(() => setStack((cur) => cur.slice(0, -1)), [])
  const replace = useCallback((s: Screen) => setStack((cur) => [...cur.slice(0, -1), s]), [])
  const reset = useCallback(() => setStack([]), [])
  return <Ctx.Provider value={{ tab, stack, setTab, push, pop, replace, reset }}>{children}</Ctx.Provider>
}
