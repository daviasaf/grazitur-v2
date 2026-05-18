export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function uniqueIds(ids: Array<number | string | null | undefined>, ignore?: number) {
  return [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0 && id !== ignore))]
}
