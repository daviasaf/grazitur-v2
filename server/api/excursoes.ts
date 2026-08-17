import { prisma } from '../utils/prisma'
import { parseJson } from '../utils/json'
import { appendLog, adminDetail } from '../utils/logs'
import { getPassengerUserId } from '../utils/passenger-auth'
import { normalizeUser } from '../utils/users'

function buildAdminSignatures(existing: Record<string, any>, users: any[], grupos: Record<string, string[]>, guia: any) {
  const assinaturas = { ...(existing || {}) }
  const dependentes = new Set(Object.values(grupos || {}).flat().map((id) => String(id)))
  for (const u of users || []) {
    if (!u || dependentes.has(String(u.id)) || String(u.id) === String(guia?.id)) continue
    const key = `admin_${u.id}`
    assinaturas[key] = assinaturas[key] || {
      data: new Date().toISOString(),
      guiaId: guia?.id || null
    }
  }
  return assinaturas
}

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const query = getQuery(event)
    const filtroFinalizada = String(query.finalizada ?? '')
    const somenteAbertas = String(query.abertas ?? query.publico ?? '') === 'true'
    const where = filtroFinalizada === 'true'
      ? { finalizada: true }
      : filtroFinalizada === 'false'
        ? { finalizada: false, ...(somenteAbertas ? { mostrarAberta: true } : {}) }
        : (somenteAbertas ? { finalizada: false, mostrarAberta: true } : {})

    if (somenteAbertas) {
      const publicTrips = await prisma.excursao.findMany({
        where,
        select: {
          id: true,
          nome: true,
          lugar: true,
          vagas: true,
          mostrarAberta: true,
          finalizada: true,
          createdAt: true,
          listaEsperaJson: true,
          _count: { select: { usuarios: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
      let passengerId: number | null = null
      try { passengerId = getPassengerUserId(event) } catch { passengerId = null }
      return publicTrips.map((trip) => ({
        id: trip.id,
        nome: trip.nome,
        lugar: trip.lugar,
        vagas: trip.vagas,
        mostrarAberta: trip.mostrarAberta,
        finalizada: trip.finalizada,
        createdAt: trip.createdAt,
        _count: trip._count,
        onWaitlist: passengerId ? parseJson<any[]>(trip.listaEsperaJson, []).some((item) => Number(item.userId) === passengerId) : false
      }))
    }

    const excursoes = await prisma.excursao.findMany({
      where,
      include: { usuarios: true, guia: true, _count: { select: { usuarios: true } } },
      orderBy: [{ finalizada: 'asc' }, { createdAt: 'desc' }]
    })

    const users = await prisma.user.findMany()
    const byId = new Map(users.map((u) => [String(u.id), u]))

    return excursoes.map((ex) => {
      const listaOriginal = parseJson<any[]>(ex.listaEsperaJson, [])
      const listaHidratada = listaOriginal
        .map((item) => {
          const user = item?.userId ? byId.get(String(item.userId)) : null
          if (!user) return null
          const normalizedUser = normalizeUser(user)
          return {
            id: item.id,
            userId: user.id,
            nome: normalizedUser.nome,
            cpf: normalizedUser.cpfMasked,
            celular: normalizedUser.celular || '',
            createdAt: item.createdAt,
            origem: item.origem
          }
        })
        .filter(Boolean)

      return {
        ...ex,
        usuarios: ex.usuarios.map((user) => normalizeUser(user)),
        guia: ex.guia ? normalizeUser(ex.guia) : null,
        listaEsperaJson: JSON.stringify(listaHidratada)
      }
    })
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const ativarContrato = Boolean(body.ativarContrato)
    const guiaId = body.guiaId ? Number(body.guiaId) : null
    if (ativarContrato && !guiaId) throw createError({ statusCode: 400, statusMessage: 'Para ativar o contrato, selecione um guia responsável.' })

    const grupos = parseJson<Record<string, string[]>>(String(body.contratoGrupos || '{}'), {})
    const assinaturasBase = parseJson<Record<string, any>>(String(body.assinaturasJson || '{}'), {})
    const assinaturasJson = ativarContrato ? JSON.stringify(buildAdminSignatures(assinaturasBase, [], grupos, guiaId ? { id: guiaId } : null)) : JSON.stringify(assinaturasBase)

    const created = await prisma.excursao.create({
      data: {
        nome: String(body.nome || ''),
        lugar: String(body.lugar || ''),
        vagas: Number(body.vagas || 0),
        guiaId,
        valores: String(body.valores || '[]'),
        ativarContrato,
        aplicarParcelas: true,
        liberarContratos: ativarContrato,
        contratoDetalhes: String(body.contratoDetalhes || '{}'),
        contratoGrupos: String(body.contratoGrupos || '{}'),
        pagamentosJson: String(body.pagamentosJson || '{}'),
        assinaturasJson,
        despesasJson: String(body.despesasJson || '[]'),
        listaEsperaJson: String(body.listaEsperaJson || '[]'),
        mostrarAberta: body.mostrarAberta === undefined ? true : Boolean(body.mostrarAberta),
        finalizada: false,
        finalizadaEm: null
      }
    })
    await appendLog({ entity: 'excursao', action: 'create', title: 'Excursão criada', detail: adminDetail('criou uma nova excursão', [`Excursão: ${created.nome}.`, `Destino: ${created.lugar || 'não informado'}.`, `Vagas: ${created.vagas}.`, guiaId ? `Guia ID: ${guiaId}.` : 'Guia: não selecionado.', `Visível em excursões abertas: ${created.mostrarAberta ? 'sim' : 'não'}.`]) })
    return created
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
