/**
 * Registro de contribuyentes a la copia de seguridad: cada módulo con datos propios
 * (Filosofía, vídeos de Combat…) se engancha aquí sin que el store raíz conozca su modelo.
 */
export interface BackupContributor {
  /** Nombre del campo en el archivo de copia */
  key: string
  export(): unknown
  import(data: unknown, mode: 'merge' | 'replace'): void
  reset(): Promise<void> | void
}

const registry = new Map<string, BackupContributor>()
export const registerBackup = (c: BackupContributor) => { registry.set(c.key, c); return () => { if (registry.get(c.key) === c) registry.delete(c.key) } }
export const backupContributors = () => [...registry.values()]
