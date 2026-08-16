import { prisma } from '../../../utils/prisma'
import { parseJson } from '../../../utils/json'
import { appendLog, adminDetail } from '../../../utils/logs'
import { requirePassengerSession } from '../../../utils/passenger-auth'

type EntradaEspera = {
  id: string
  userId: number
  createdAt: string
  origem: string
}

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const body = await readBody<Record<string, unknown>>(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })

  const excursao = await prisma.excursao.findUnique({ where: { id }, include: { usuarios: true } })
  if (!excursao) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
  if (excursao.finalizada) throw createError({ statusCode: 400, statusMessage: 'Esta excursão já foi finalizada.' })

  const sessionUserId = requirePassengerSession(event)
  const userId = Number(body.userId || sessionUserId)
  const owner = await prisma.user.findUnique({ where: { id: sessionUserId }, include: { parentes: true, parentesDe: true } })
  const allowedIds = new Set([sessionUserId, ...(owner?.parentes || []).map((item) => item.id), ...(owner?.parentesDe || []).map((item) => item.id)])
  if (!allowedIds.has(userId)) throw createError({ statusCode: 403, statusMessage: 'Não é permitido incluir outro passageiro.' })
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Passageiro não encontrado.' })
  if (excursao.usuarios.some((item) => item.id === userId)) throw createError({ statusCode: 400, statusMessage: 'Este passageiro já está vinculado a esta excursão.' })

  const lista = parseJson<EntradaEspera[]>(excursao.listaEsperaJson, [])
  const jaExiste = lista.some((item) => Number(item.userId) === userId)
  if (jaExiste) return { success: true, alreadyExists: true, lista }

  lista.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    createdAt: new Date().toISOString(),
    origem: String(body.origem || 'Área do passageiro')
  })

  await prisma.excursao.update({ where: { id }, data: { listaEsperaJson: JSON.stringify(lista) } })
  await appendLog({ entity: 'excursao', action: 'waitlist-create', title: 'Pessoa entrou na lista de espera', detail: adminDetail('registrou interesse em uma viagem', [`Passageiro ID: ${userId}.`, `Excursão: ${excursao.nome}.`, `Origem: ${String(body.origem || 'Área do passageiro')}.`]) })
  return { success: true, lista }
})
