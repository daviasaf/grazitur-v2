export const userFamilyInclude = {
  kinshipsFrom: { include: { relativeUser: true } },
  kinshipsTo: { include: { user: true } }
} as const

export const excursionUsersInclude = {
  userLinks: { include: { user: true } }
} as const

export function relatedUsers(user: Record<string, any> | null | undefined) {
  if (!user) return []
  const direct = Array.isArray(user.parentes) ? user.parentes : []
  const reverse = Array.isArray(user.parentesDe) ? user.parentesDe : []
  const from = Array.isArray(user.kinshipsFrom)
    ? user.kinshipsFrom.map((link: any) => link?.relativeUser).filter(Boolean)
    : []
  const to = Array.isArray(user.kinshipsTo)
    ? user.kinshipsTo.map((link: any) => link?.user).filter(Boolean)
    : []
  const byId = new Map<number, Record<string, any>>()
  for (const relative of [...direct, ...reverse, ...from, ...to]) {
    const id = Number(relative?.id)
    if (Number.isFinite(id) && id !== Number(user.id)) byId.set(id, relative)
  }
  return [...byId.values()]
}

export function attachUserFamily<T extends Record<string, any>>(user: T) {
  const parentes = relatedUsers(user)
  const parentesDe = Array.isArray(user.kinshipsTo)
    ? user.kinshipsTo.map((link: any) => link?.user).filter(Boolean)
    : (Array.isArray(user.parentesDe) ? user.parentesDe : [])
  const safe = { ...user }
  delete safe.kinshipsFrom
  delete safe.kinshipsTo
  return { ...safe, parentes, parentesDe } as T & { parentes: any[], parentesDe: any[] }
}

export function excursionUsers(excursion: Record<string, any> | null | undefined) {
  if (!excursion) return []
  if (Array.isArray(excursion.usuarios)) return excursion.usuarios
  return Array.isArray(excursion.userLinks)
    ? excursion.userLinks.map((link: any) => link?.user).filter(Boolean)
    : []
}

export function attachExcursionUsers<T extends Record<string, any>>(excursion: T) {
  const usuarios = excursionUsers(excursion)
  const safe: Record<string, any> = { ...excursion }
  delete safe.userLinks
  if (safe._count) {
    const count = Number(safe._count.userLinks ?? safe._count.usuarios ?? usuarios.length)
    safe._count = { ...safe._count, usuarios: count }
    delete safe._count.userLinks
  }
  return { ...safe, usuarios } as T & { usuarios: any[] }
}
