import { moneyToNumber } from '../../../../app/utils/formatadores'
import { prisma } from '../../../utils/prisma'
import { parseJson } from '../../../utils/json'
import { appendLog, adminDetail } from '../../../utils/logs'

type Despesa = {
  id: string
  descricao: string
  valor: number
  data?: string
  createdAt: string
}

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const body = await readBody<Record<string, unknown>>(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })

  const excursao = await prisma.excursao.findUnique({ where: { id } })
  if (!excursao) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
  if (excursao.finalizada) throw createError({ statusCode: 400, statusMessage: 'Não é possível lançar despesa em excursão finalizada.' })

  const valor = Math.abs(moneyToNumber(body.valor as string | number | null | undefined))
  const descricao = String(body.descricao || '').trim()
  if (!valor) throw createError({ statusCode: 400, statusMessage: 'Informe o valor da despesa.' })
  if (!descricao) throw createError({ statusCode: 400, statusMessage: 'Informe o nome/descrição da despesa.' })

  const despesas = parseJson<Despesa[]>(excursao.despesasJson, [])
  const totalAnterior = despesas.reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0)
  despesas.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    descricao,
    valor,
    data: body.data ? String(body.data) : undefined,
    createdAt: new Date().toISOString()
  })

  const totalAtual = despesas.reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0)
  await prisma.excursao.update({ where: { id }, data: { despesasJson: JSON.stringify(despesas) } })
  await appendLog({ entity: 'financeiro', action: 'expense-create', title: 'Despesa adicionada', detail: adminDetail('adicionou despesa em uma excursão', [`Excursão: ${excursao.nome}.`, `Despesa adicionada: ${descricao}.`, `Valor da despesa: R$ ${valor.toFixed(2).replace('.', ',')}.`, `Total de gastos antes: R$ ${totalAnterior.toFixed(2).replace('.', ',')}.`, `Total de gastos depois: R$ ${totalAtual.toFixed(2).replace('.', ',')}.`, body.data ? `Data informada: ${String(body.data)}.` : 'Data informada: não preenchida.']) })
  return { success: true, despesas }
})
