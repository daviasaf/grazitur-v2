import { moneyToNumber } from '../../app/utils/formatadores'
import { parseJson } from './json'

type ValorOpcao = { valor: number | string; vezes: number | string }
type Despesa = { id?: string; descricao?: string; valor: number | string; categoria?: string; data?: string; createdAt?: string }

export const moneyNumber = (input: unknown) => moneyToNumber(input as string | number | null | undefined)

export const totalFromValorOpcao = (v?: ValorOpcao) => {
  if (!v) return 0
  return (Number(v.vezes) || 1) * moneyNumber(v.valor)
}

export const totalFromPagamento = (pagamento?: string) => {
  if (!pagamento) return 0
  if (/isento/i.test(pagamento)) return 0
  const match = pagamento.match(/(\d+)\s*x\s*de\s*R\$?\s*([\d.,]+)/i)
  if (match) return Number(match[1]) * moneyNumber(match[2])
  const single = pagamento.match(/R\$\s*([\d.,]+)/i)
  if (single) return moneyNumber(single[1])
  return 0
}

export function calcularFinanceiro(excursao: {
  valores?: unknown
  pagamentosJson?: unknown
  despesasJson?: unknown
  aplicarParcelas?: boolean
  usuarios?: Array<{ id: number }>
}) {
  const valores = parseJson<ValorOpcao[]>(excursao.valores, [])
  const pagamentos = parseJson<Record<string, string>>(excursao.pagamentosJson, {})
  const despesas = parseJson<Despesa[]>(excursao.despesasJson, [])
  const usuarios = excursao.usuarios || []

  let receita = 0

  for (const user of usuarios) {
    const pagamento = pagamentos[String(user.id)]
    if (pagamento) receita += totalFromPagamento(pagamento)
    else if (!excursao.aplicarParcelas && valores[0]) receita += totalFromValorOpcao(valores[0])
  }

  const gastosPorCategoria = new Map<string, number>()
  const gastos = despesas.reduce((sum, d) => {
    const valor = Math.abs(moneyNumber(d.valor))
    const categoria = d.categoria || d.descricao || 'Outros'
    gastosPorCategoria.set(categoria, (gastosPorCategoria.get(categoria) || 0) + valor)
    return sum + valor
  }, 0)

  return {
    receita,
    gastos,
    lucro: receita - gastos,
    despesas,
    gastosPorCategoria: [...gastosPorCategoria.entries()].map(([categoria, valor]) => ({ categoria, valor }))
  }
}
