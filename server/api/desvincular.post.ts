import { prisma } from '../utils/prisma'
import { parseJson } from '../utils/json'
import { appendLog, adminDetail } from '../utils/logs'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const userId = Number(body.userId)
  const excursaoId = Number(body.excursaoId)

  const excursao = await prisma.excursao.findUnique({ where: { id: excursaoId } })
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!excursao) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
  if (excursao.finalizada) throw createError({ statusCode: 400, statusMessage: 'Esta excursão já foi finalizada.' })

  const pagamentos = parseJson<Record<string, string>>(excursao.pagamentosJson, {})
  const grupos = parseJson<Record<string, string[]>>(excursao.contratoGrupos, {})
  const assinaturas = parseJson<Record<string, any>>(excursao.assinaturasJson, {})

  delete pagamentos[String(userId)]
  delete assinaturas[String(userId)]
  delete assinaturas[`admin_${userId}`]
  delete grupos[String(userId)]

  for (const liderId of Object.keys(grupos)) {
    grupos[liderId] = (grupos[liderId] || []).filter((id) => String(id) !== String(userId))
    if (grupos[liderId].length === 0) delete grupos[liderId]
  }

  await prisma.excursao.update({
    where: { id: excursaoId },
    data: {
      usuarios: { disconnect: { id: userId } },
      pagamentosJson: JSON.stringify(pagamentos),
      contratoGrupos: JSON.stringify(grupos),
      assinaturasJson: JSON.stringify(assinaturas)
    }
  })

  await appendLog({ entity: 'vinculo', action: 'delete', title: 'Passageiro removido da excursão', detail: adminDetail('removeu passageiro de uma excursão', [`Passageiro ID: ${userId}.`, `Excursão: ${excursao.nome}.`, 'Foram removidos pagamento, assinatura e vínculos de grupo deste passageiro dentro da viagem.']) })
  return { success: true }
})
