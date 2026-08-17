import { prisma } from '../utils/prisma'
import { parseJson } from '../utils/json'
import { appendLog, adminDetail } from '../utils/logs'

function adminSignature(guiaId: number | null) {
  return {
    data: new Date().toISOString(),
    guiaId
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const userId = Number(body.userId)
  const excursaoId = Number(body.excursaoId)
  const liderId = body.liderId ? Number(body.liderId) : null
  const opcaoPagamento = body.opcaoPagamento ? String(body.opcaoPagamento) : null

  if (!userId || !excursaoId) throw createError({ statusCode: 400, statusMessage: 'Dados incompletos.' })

  const excursao = await prisma.excursao.findUnique({
    where: { id: excursaoId },
    include: { usuarios: true, _count: { select: { usuarios: true } } }
  })
  if (!excursao) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
  if (excursao.finalizada) throw createError({ statusCode: 400, statusMessage: 'Esta excursão já foi finalizada.' })
  if (excursao.usuarios.some((u) => u.id === userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Este passageiro já está nesta excursão.' })
  }
  if (excursao._count.usuarios >= excursao.vagas) {
    throw createError({ statusCode: 400, statusMessage: 'Esta excursão já atingiu o limite de vagas. Libere uma vaga ou aumente a capacidade antes de continuar.' })
  }
  if (excursao.guiaId === userId) {
    throw createError({ statusCode: 400, statusMessage: 'O guia já está vinculado como responsável.' })
  }

  const pagamentos = parseJson<Record<string, string>>(excursao.pagamentosJson, {})
  if (opcaoPagamento) pagamentos[String(userId)] = opcaoPagamento

  const grupos = parseJson<Record<string, string[]>>(excursao.contratoGrupos, {})
  if (liderId && liderId !== userId) {
    const atual = grupos[String(liderId)] || []
    grupos[String(liderId)] = [...new Set([...atual.map(String), String(userId)])]
  }

  const assinaturas = parseJson<Record<string, any>>(excursao.assinaturasJson, {})
  if (excursao.ativarContrato && excursao.guiaId && (!liderId || liderId === userId)) {
    assinaturas[`admin_${userId}`] = assinaturas[`admin_${userId}`] || adminSignature(excursao.guiaId)
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  await prisma.excursao.update({
    where: { id: excursaoId },
    data: {
      usuarios: { connect: { id: userId } },
      pagamentosJson: JSON.stringify(pagamentos),
      contratoGrupos: JSON.stringify(grupos),
      assinaturasJson: JSON.stringify(assinaturas)
    }
  })

  await appendLog({ entity: 'vinculo', action: 'create', title: 'Passageiro adicionado à excursão', detail: adminDetail('adicionou passageiro à excursão', [`Passageiro ID: ${userId}.`, `Excursão: ${excursao.nome}.`, opcaoPagamento ? `Pagamento definido: ${opcaoPagamento}.` : 'Pagamento definido: pendente / a combinar.', liderId && liderId !== userId ? `Adicionado como dependente do titular #${liderId}.` : 'Adicionado como passageiro titular.']) })
  return { success: true }
})
