import { prisma } from '../../utils/prisma'
import { parseJson } from '../../utils/json'
import { findUserByCpf, normalizeUser } from '../../utils/users'
import { clearPassengerSession, getPassengerUserId, requirePassengerSession, setPassengerSession } from '../../utils/passenger-auth'

const dateDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '')

function filterRecord(record: Record<string, any>, allowedIds: Set<string>, includeAdmin = false) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => {
    if (includeAdmin && key.startsWith('admin_')) return allowedIds.has(key.slice(6))
    return allowedIds.has(key)
  }))
}

async function passengerPayload(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { parentes: true, parentesDe: true } })
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Sessão inválida.' })

  const excursoes = await prisma.excursao.findMany({
    where: { finalizada: false, usuarios: { some: { id: user.id } } },
    include: { usuarios: true, guia: true, _count: { select: { usuarios: true } } },
    orderBy: { createdAt: 'desc' }
  })

  const formatadas = excursoes.map((ex) => {
    const grupos = parseJson<Record<string, string[]>>(ex.contratoGrupos, {})
    let leaderId = String(user.id)
    for (const [candidate, dependents] of Object.entries(grupos)) {
      if (dependents.map(String).includes(String(user.id))) leaderId = candidate
    }
    const allowedIds = new Set([leaderId, ...(grupos[leaderId] || []).map(String)])
    const pagamentos = filterRecord(parseJson<Record<string, any>>(ex.pagamentosJson, {}), allowedIds)
    const assinaturas = filterRecord(parseJson<Record<string, any>>(ex.assinaturasJson, {}), allowedIds, true)
    const grupoVisivel = grupos[leaderId] ? { [leaderId]: grupos[leaderId] } : {}

    return {
      id: ex.id,
      nome: ex.nome,
      lugar: ex.lugar,
      vagas: ex.vagas,
      valores: parseJson(ex.valores, []),
      guiaId: ex.guiaId,
      guia: ex.guia ? { id: ex.guia.id, nome: ex.guia.nome } : null,
      ativarContrato: ex.ativarContrato,
      aplicarParcelas: ex.aplicarParcelas,
      liberarContratos: ex.liberarContratos,
      mostrarAberta: ex.mostrarAberta,
      finalizada: ex.finalizada,
      createdAt: ex.createdAt,
      pagamentos,
      detalhes: parseJson(ex.contratoDetalhes, {}),
      grupos: grupoVisivel,
      assinaturas,
      usuarios: ex.usuarios.filter((item) => allowedIds.has(String(item.id))).map((item) => normalizeUser(item, { revealCpf: true })),
      _count: ex._count
    }
  })

  return { user: normalizeUser(user, { revealCpf: true }), excursoes: formatadas }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const method = getMethod(event)

  if (method === 'DELETE') {
    clearPassengerSession(event)
    return { success: true }
  }

  if (method === 'GET') {
    return await passengerPayload(requirePassengerSession(event))
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const user = await findUserByCpf(body.cpf)
    if (!user || !dateDigits(body.nascimento) || dateDigits(user.nascimento) !== dateDigits(body.nascimento)) {
      throw createError({ statusCode: 401, statusMessage: 'CPF ou data de nascimento não conferem.' })
    }
    setPassengerSession(event, user.id)
    return await passengerPayload(user.id)
  }

  const sessionUserId = getPassengerUserId(event)
  if (!sessionUserId) throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
  return await passengerPayload(sessionUserId)
})
