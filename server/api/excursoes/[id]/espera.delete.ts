import { prisma } from '../../../utils/prisma'
import { parseJson } from '../../../utils/json'
import { appendLog, adminDetail } from '../../../utils/logs'

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const body = await readBody<Record<string, unknown>>(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })
  const excursao = await prisma.excursao.findUnique({ where: { id } })
  if (!excursao) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })

  const entradaId = String(body.entradaId || '')
  const userId = body.userId ? Number(body.userId) : null
  const listaOriginal = parseJson<any[]>(excursao.listaEsperaJson, [])
  const removidos: any[] = []
  const lista = listaOriginal.filter((item) => {
    const remover = Boolean(
      (entradaId && String(item.id) === entradaId) ||
      (userId && Number(item.userId) === userId)
    )
    if (remover) removidos.push(item)
    return !remover
  })

  await prisma.excursao.update({ where: { id }, data: { listaEsperaJson: JSON.stringify(lista) } })
  const nomes = removidos.map((item) => item.nome || 'Nome não informado').join(', ') || 'registro não identificado'
  await appendLog({
    entity: 'excursao',
    action: 'waitlist-delete',
    title: 'Lista de espera atualizada',
    detail: adminDetail('removeu pessoa da lista de espera', [
      `Admin removeu ${nomes} da lista de espera da excursão ${excursao.nome}.`,
      `Pessoa removida: ${nomes}.`,
      `Excursão: ${excursao.nome}.`,
      `Total removido: ${removidos.length}.`,
      `Antes: ${listaOriginal.length} registro(s).`,
      `Depois: ${lista.length} registro(s).`,
      'A lista de espera foi atualizada no banco de dados.'
    ])
  })
  return { success: true, lista, removed: removidos.length }
})
