import { prisma } from '../../utils/prisma'
import { parseJson } from '../../utils/json'
import { appendLog, buildDetail } from '../../utils/logs'
import { requirePassengerSession } from '../../utils/passenger-auth'

function databaseErrorMessage(error: any) {
  if (error?.code === 'P1001' || String(error?.message || '').includes("Can't reach database server")) {
    return 'Não foi possível conectar ao banco de dados. Confira o DATABASE_URL/DIRECT_URL do Supabase, a senha e se o projeto está ativo.'
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const userId = requirePassengerSession(event, Number(body.userId))
  const excursaoId = Number(body.excursaoId)

  if (!userId || !excursaoId) throw createError({ statusCode: 400, statusMessage: 'Dados incompletos.' })

  try {
    const excursao = await prisma.excursao.findUnique({ where: { id: excursaoId }, include: { guia: true, usuarios: { select: { id: true } } } })
    if (!excursao) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
    if (excursao.finalizada) throw createError({ statusCode: 400, statusMessage: 'Esta excursão já foi finalizada.' })
    if (!excursao.ativarContrato || !excursao.liberarContratos) {
      throw createError({ statusCode: 403, statusMessage: 'Contrato não liberado.' })
    }
    if (!excursao.guiaId) {
      throw createError({ statusCode: 403, statusMessage: 'A excursão precisa ter guia para liberar assinatura de contrato.' })
    }
    if (!excursao.usuarios.some((item) => item.id === userId)) {
      throw createError({ statusCode: 403, statusMessage: 'Passageiro não vinculado a esta excursão.' })
    }

    const grupos = parseJson<Record<string, string[]>>(excursao.contratoGrupos, {})
    const ehDependente = Object.values(grupos).some((deps) => deps.map(String).includes(String(userId)))
    if (ehDependente) {
      throw createError({ statusCode: 403, statusMessage: 'Dependentes não assinam. O titular do grupo assina por eles.' })
    }

    const assinaturas = parseJson<Record<string, any>>(excursao.assinaturasJson, {})
    assinaturas[String(userId)] = new Date().toISOString()
    assinaturas[`admin_${userId}`] = assinaturas[`admin_${userId}`] || {
      data: new Date().toISOString(),
      guiaNome: excursao.guia?.nome || 'Grazi Turismo'
    }

    await prisma.excursao.update({ where: { id: excursaoId }, data: { assinaturasJson: JSON.stringify(assinaturas) } })
    const user = await prisma.user.findUnique({ where: { id: userId } })
    await appendLog({ entity: 'contrato', action: 'sign', title: 'Contrato assinado pelo passageiro', detail: buildDetail(['Responsável: Passageiro.', 'Ação: assinou contrato digital.', `Passageiro ID: ${userId}.`, `Excursão ID: ${excursao.id}.`, `Guia ID: ${excursao.guiaId || 'não definido'}.`, `Assinado em: ${new Date().toISOString()}.`]) })
    return { success: true, assinaturas }
  } catch (error: any) {
    if (error?.statusCode) throw error
    const message = databaseErrorMessage(error)
    if (message) throw createError({ statusCode: 503, statusMessage: message })
    throw createError({ statusCode: 500, statusMessage: 'Erro ao registrar assinatura do contrato.' })
  }
})
