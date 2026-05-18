import { prisma } from './prisma'

export type SystemLogEntry = {
  id: string
  createdAt: string
  entity: string
  action: string
  title: string
  detail?: string | null
}

function normalizeLog(log: any): SystemLogEntry {
  return {
    id: String(log.id),
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt || new Date().toISOString()),
    entity: String(log.entity || 'sistema'),
    action: String(log.action || 'manual'),
    title: String(log.title || 'Registro do sistema'),
    detail: log.detail ?? null
  }
}

export function buildDetail(lines: Array<string | null | undefined | false>) {
  return lines.filter(Boolean).map((line) => String(line).trim()).filter(Boolean).join('\n')
}

export function adminDetail(action: string, lines: Array<string | null | undefined | false>) {
  return buildDetail([
    `Responsável: Admin.`,
    `Ação: ${action}.`,
    ...lines
  ])
}

export async function readLogs(): Promise<SystemLogEntry[]> {
  try {
    const logs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000
    })
    return logs.map(normalizeLog)
  } catch (error) {
    console.error('Erro ao ler logs do banco:', error)
    return []
  }
}

export async function appendLog(entry: Omit<SystemLogEntry, 'id' | 'createdAt'>) {
  try {
    await prisma.systemLog.create({
      data: {
        entity: String(entry.entity || 'sistema'),
        action: String(entry.action || 'manual'),
        title: String(entry.title || 'Registro do sistema'),
        detail: entry.detail ? String(entry.detail) : null
      }
    })
  } catch (error) {
    console.error('Erro ao salvar log no banco:', error)
  }
}

export async function writeLogs(entries: SystemLogEntry[]) {
  try {
    await prisma.systemLog.deleteMany()
    if (entries.length) {
      await prisma.systemLog.createMany({
        data: entries.map((entry) => ({
          id: String(entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
          createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
          entity: String(entry.entity || 'sistema'),
          action: String(entry.action || 'manual'),
          title: String(entry.title || 'Registro do sistema'),
          detail: entry.detail ? String(entry.detail) : null
        })),
        skipDuplicates: true
      })
    }
  } catch (error) {
    console.error('Erro ao sobrescrever logs no banco:', error)
  }
}

export type DeleteLogsFilters = {
  entity?: string
  action?: string
  excursao?: string
  dataInicial?: string
  dataFinal?: string
  termo?: string
}

export async function deleteLogs(filters: DeleteLogsFilters) {
  const current = await readLogs()
  const shouldDelete = (log: SystemLogEntry) => {
    const texto = `${log.title || ''} ${log.detail || ''}`.toLowerCase()
    if (filters.entity && String(log.entity || '') !== filters.entity) return false
    if (filters.action && String(log.action || '') !== filters.action) return false
    if (filters.excursao && !texto.includes(filters.excursao.toLowerCase())) return false
    if (filters.termo && !texto.includes(filters.termo.toLowerCase())) return false
    const data = new Date(log.createdAt)
    if (filters.dataInicial && data < new Date(`${filters.dataInicial}T00:00:00`)) return false
    if (filters.dataFinal && data > new Date(`${filters.dataFinal}T23:59:59`)) return false
    return true
  }
  const ids = current.filter(shouldDelete).map((log) => log.id)
  if (ids.length) {
    await prisma.systemLog.deleteMany({ where: { id: { in: ids } } })
  }
  return { deleted: ids.length, remaining: current.length - ids.length }
}
