import { prisma } from '../utils/prisma'
import { parseJson } from '../utils/json'
import { appendLog, adminDetail } from '../utils/logs'

function buildAdminSignatures(existing: Record<string, any>, users: any[], grupos: Record<string, string[]>, guia: any) {
  const assinaturas = { ...(existing || {}) }
  const dependentes = new Set(Object.values(grupos || {}).flat().map((id) => String(id)))
  for (const u of users || []) {
    if (!u || dependentes.has(String(u.id)) || String(u.id) === String(guia?.id)) continue
    const key = `admin_${u.id}`
    assinaturas[key] = assinaturas[key] || {
      data: new Date().toISOString(),
      guiaNome: guia?.nome || '58.904.532 LÍVIA GRAZIELA DOS SANTOS - GRAZI TURISMO',
      guiaCpf: guia?.cpf || '',
      guiaCelular: guia?.celular || ''
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

    const excursoes = await prisma.excursao.findMany({
      where,
      include: { usuarios: true, guia: true, _count: { select: { usuarios: true } } },
      orderBy: [{ finalizada: 'asc' }, { createdAt: 'desc' }]
    })

    const users = await prisma.user.findMany({ select: { id: true, nome: true, cpf: true, celular: true } })
    const byId = new Map(users.map((u) => [String(u.id), u]))
    const byCpf = new Map(users.map((u) => [String(u.cpf || '').replace(/\D/g, ''), u]))

    return await Promise.all(excursoes.map(async (ex) => {
      const listaOriginal = parseJson<any[]>(ex.listaEsperaJson, [])
      const listaHidratada = listaOriginal
        .map((item) => {
          const user = item?.userId ? byId.get(String(item.userId)) : byCpf.get(String(item?.cpf || '').replace(/\D/g, ''))
          if (!user) return null
          return {
            ...item,
            userId: user.id,
            nome: user.nome,
            cpf: user.cpf,
            celular: user.celular || item.celular || ''
          }
        })
        .filter(Boolean)

      if (JSON.stringify(listaOriginal) !== JSON.stringify(listaHidratada)) {
        await prisma.excursao.update({ where: { id: ex.id }, data: { listaEsperaJson: JSON.stringify(listaHidratada) } })
      }

      return { ...ex, listaEsperaJson: JSON.stringify(listaHidratada) }
    }))
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const ativarContrato = Boolean(body.ativarContrato)
    const guiaId = body.guiaId ? Number(body.guiaId) : null
    if (ativarContrato && !guiaId) throw createError({ statusCode: 400, statusMessage: 'Para ativar o contrato, selecione um guia responsável.' })

    const grupos = parseJson<Record<string, string[]>>(String(body.contratoGrupos || '{}'), {})
    const assinaturasBase = parseJson<Record<string, any>>(String(body.assinaturasJson || '{}'), {})
    const guia = guiaId ? await prisma.user.findUnique({ where: { id: guiaId } }) : null
    const assinaturasJson = ativarContrato ? JSON.stringify(buildAdminSignatures(assinaturasBase, [], grupos, guia)) : JSON.stringify(assinaturasBase)

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
    await appendLog({ entity: 'excursao', action: 'create', title: 'Excursão criada', detail: adminDetail('criou uma nova excursão', [`Excursão: ${created.nome}.`, `Destino: ${created.lugar || 'não informado'}.`, `Vagas: ${created.vagas}.`, guia?.nome ? `Guia: ${guia.nome}.` : 'Guia: não selecionado.', `Visível em excursões abertas: ${created.mostrarAberta ? 'sim' : 'não'}.`]) })
    return created
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
