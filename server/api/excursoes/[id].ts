import { prisma } from '../../utils/prisma'
import { parseJson } from '../../utils/json'
import { appendLog, adminDetail } from '../../utils/logs'
import { normalizeUser } from '../../utils/users'

const PAGAMENTOS_MENSAIS_KEY = '__pagamentosMensais'

const boolFromBody = (value: unknown, fallback: boolean) => {
  if (value === undefined || value === null) return fallback
  return Boolean(value)
}

const fmt = (value: unknown) => String(value ?? 'não informado')
const brlLog = (value: unknown) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const changeLine = (label: string, before: unknown, after: unknown) => String(before ?? '') !== String(after ?? '') ? `${label}: ${fmt(before)} → ${fmt(after)}.` : null

const pagamentosSemInternos = (value: string | null | undefined) => {
  const parsed = parseJson<Record<string, any>>(value || '{}', {})
  delete parsed[PAGAMENTOS_MENSAIS_KEY]
  return parsed
}

function buildAdminSignatures(existing: Record<string, any>, users: any[], grupos: Record<string, string[]>, guia: any) {
  const assinaturas = { ...(existing || {}) }
  const dependentes = new Set(Object.values(grupos || {}).flat().map((id) => String(id)))
  for (const u of users || []) {
    if (!u || dependentes.has(String(u.id)) || String(u.id) === String(guia?.id)) continue
    const key = `admin_${u.id}`
    assinaturas[key] = assinaturas[key] || {
      data: new Date().toISOString(),
      guiaNome: guia?.nome || 'Grazi Turismo'
    }
  }
  return assinaturas
}

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const method = getMethod(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })

  if (method === 'GET') {
    const purpose = String(getQuery(event).purpose || '').trim()
    if (purpose.length < 8) throw createError({ statusCode: 400, statusMessage: 'Informe a finalidade do acesso aos dados completos.' })
    const excursion = await prisma.excursao.findUnique({ where: { id }, include: { usuarios: true, guia: true, _count: { select: { usuarios: true } } } })
    if (!excursion) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
    setResponseHeader(event, 'Cache-Control', 'no-store')
    await appendLog({ entity: 'privacy', action: 'sensitive-export', title: 'Dados completos liberados para documento', detail: adminDetail('acessou dados completos para documento', [`Excursão ID: ${id}.`, `Finalidade declarada: ${purpose}.`]) })
    return {
      ...excursion,
      usuarios: excursion.usuarios.map((user) => normalizeUser(user, { revealCpf: true })),
      guia: excursion.guia ? normalizeUser(excursion.guia, { revealCpf: true }) : null
    }
  }

  if (method === 'DELETE') {
    const atual = await prisma.excursao.findUnique({ where: { id } })
    if (!atual) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
    await prisma.excursao.delete({ where: { id } })
    await appendLog({ entity: 'excursao', action: 'delete', title: atual.finalizada ? 'Excursão finalizada apagada' : 'Excursão apagada', detail: adminDetail('apagou uma excursão', [`Excursão: ${atual.nome}.`, `Destino: ${atual.lugar || 'não informado'}.`, `Status anterior: ${atual.finalizada ? 'finalizada' : 'ativa'}.`, atual.finalizada ? 'A exclusão foi feita após confirmar edição de excursão finalizada.' : 'A excursão foi removida da base administrativa.']) })
    return { success: true }
  }

  if (method === 'PUT') {
    const body = await readBody<Record<string, unknown>>(event)
    const atual = await prisma.excursao.findUnique({ where: { id }, include: { usuarios: true, guia: true } })
    if (!atual) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })

    let assinaturas = parseJson<Record<string, any>>(atual.assinaturasJson, {})
    const pagamentosAntigos = atual.pagamentosJson || '{}'
    const pagamentosNovos = String(body.pagamentosJson ?? pagamentosAntigos)
    const pagamentosPublicosAlterados = JSON.stringify(pagamentosSemInternos(pagamentosAntigos)) !== JSON.stringify(pagamentosSemInternos(pagamentosNovos))
    const gruposAntigos = atual.contratoGrupos || '{}'
    const gruposNovos = String(body.contratoGrupos ?? gruposAntigos)
    const detalhesAntigos = atual.contratoDetalhes || '{}'
    const detalhesNovos = String(body.contratoDetalhes ?? detalhesAntigos)

    if (pagamentosPublicosAlterados || gruposAntigos !== gruposNovos || detalhesAntigos !== detalhesNovos) {
      const assinaturasAtuais = parseJson<Record<string, any>>(String(body.assinaturasJson || atual.assinaturasJson || '{}'), {})
      assinaturas = Object.fromEntries(Object.entries(assinaturasAtuais).filter(([k]) => k.startsWith('admin_')))
    }

    const ativarContrato = boolFromBody(body.ativarContrato, atual.ativarContrato)
    const guiaId = body.guiaId === undefined ? atual.guiaId : (body.guiaId ? Number(body.guiaId) : null)
    if (ativarContrato && !guiaId) throw createError({ statusCode: 400, statusMessage: 'Para ativar o contrato, selecione um guia responsável.' })
    const grupos = parseJson<Record<string, string[]>>(gruposNovos, {})
    const guia = guiaId ? await prisma.user.findUnique({ where: { id: guiaId } }) : null
    if (ativarContrato) assinaturas = buildAdminSignatures(assinaturas, atual.usuarios, grupos, guia)

    const finalizada = boolFromBody(body.finalizada, atual.finalizada)
    const finalizadaEm = finalizada ? (atual.finalizadaEm || new Date()) : null

    const updated = await prisma.excursao.update({
      where: { id },
      data: {
        nome: String(body.nome ?? atual.nome),
        lugar: String(body.lugar ?? atual.lugar),
        vagas: Number(body.vagas ?? atual.vagas),
        guiaId,
        valores: String(body.valores ?? atual.valores ?? '[]'),
        ativarContrato,
        aplicarParcelas: true,
        liberarContratos: ativarContrato,
        contratoDetalhes: detalhesNovos,
        contratoGrupos: gruposNovos,
        pagamentosJson: pagamentosNovos,
        assinaturasJson: JSON.stringify(assinaturas),
        despesasJson: String(body.despesasJson ?? atual.despesasJson ?? '[]'),
        listaEsperaJson: String(body.listaEsperaJson ?? atual.listaEsperaJson ?? '[]'),
        mostrarAberta: boolFromBody(body.mostrarAberta, (atual as any).mostrarAberta ?? true),
        finalizada,
        finalizadaEm
      }
    })

    const changes: string[] = []
    const detalhesAlteracoes: Array<string | null> = []
    const novoNome = String(body.nome ?? atual.nome)
    const novoLugar = String(body.lugar ?? atual.lugar)
    const novasVagas = Number(body.vagas ?? atual.vagas)
    const novasDespesasJson = String(body.despesasJson ?? atual.despesasJson ?? '[]')
    const novoMostrarAberta = boolFromBody(body.mostrarAberta, (atual as any).mostrarAberta ?? true)

    if (novoNome !== atual.nome) { changes.push('nome'); detalhesAlteracoes.push(changeLine('Nome', atual.nome, novoNome)) }
    if (novoLugar !== atual.lugar) { changes.push('destino'); detalhesAlteracoes.push(changeLine('Destino', atual.lugar, novoLugar)) }
    if (novasVagas !== atual.vagas) { changes.push('vagas'); detalhesAlteracoes.push(changeLine('Vagas', atual.vagas, novasVagas)) }
    if (guiaId !== atual.guiaId) {
      const guiaAntigo = atual.guia?.nome || (atual.guiaId ? `Guia #${atual.guiaId}` : 'sem guia')
      const guiaNovo = guia?.nome || (guiaId ? `Guia #${guiaId}` : 'sem guia')
      changes.push('guia')
      detalhesAlteracoes.push(`Guia: ${guiaAntigo} → ${guiaNovo}.`)
    }
    if (detalhesNovos !== (atual.contratoDetalhes || '{}')) { changes.push('detalhes do contrato'); detalhesAlteracoes.push('Detalhes do contrato foram alterados.') }
    if (gruposNovos !== (atual.contratoGrupos || '{}')) { changes.push('grupos familiares'); detalhesAlteracoes.push('Grupos familiares foram alterados.') }
    if (pagamentosNovos !== (atual.pagamentosJson || '{}')) changes.push(pagamentosPublicosAlterados ? 'pagamentos' : 'pagamentos mensais')
    if (novasDespesasJson !== (atual.despesasJson || '[]')) changes.push('despesas')
    if (String(body.listaEsperaJson ?? atual.listaEsperaJson ?? '[]') !== (atual.listaEsperaJson || '[]')) { changes.push('lista de espera'); detalhesAlteracoes.push('Lista de espera foi alterada.') }
    const pagamentoDetalhes: string[] = []
    if (pagamentosPublicosAlterados) {
      const antigos = pagamentosSemInternos(atual.pagamentosJson)
      const novos = pagamentosSemInternos(pagamentosNovos)
      const ids = [...new Set([...Object.keys(antigos), ...Object.keys(novos)])]
      for (const pid of ids) {
        if (String(antigos[pid] || 'Pendente') !== String(novos[pid] || 'Pendente')) {
          const user = atual.usuarios.find((u) => String(u.id) === String(pid))
          pagamentoDetalhes.push(`${user?.nome || `Passageiro #${pid}`}: ${antigos[pid] || 'Pendente'} → ${novos[pid] || 'Pendente'}.`)
        }
      }
    }

    const despesaDetalhes: string[] = []
    if (novasDespesasJson !== (atual.despesasJson || '[]')) {
      const despesasAntigas = parseJson<any[]>(atual.despesasJson, [])
      const despesasNovas = parseJson<any[]>(novasDespesasJson, [])
      const novasPorId = new Map(despesasNovas.map((d) => [String(d.id || d.descricao), d]))
      const antigasPorId = new Map(despesasAntigas.map((d) => [String(d.id || d.descricao), d]))
      for (const antiga of despesasAntigas) {
        const key = String(antiga.id || antiga.descricao)
        if (!novasPorId.has(key)) despesaDetalhes.push(`Despesa removida: ${antiga.descricao || 'Despesa'} no valor de ${brlLog(antiga.valor)}.`)
      }
      for (const nova of despesasNovas) {
        const key = String(nova.id || nova.descricao)
        if (!antigasPorId.has(key)) despesaDetalhes.push(`Despesa adicionada: ${nova.descricao || 'Despesa'} no valor de ${brlLog(nova.valor)}.`)
      }
    }

    if (ativarContrato !== atual.ativarContrato) { changes.push(ativarContrato ? 'contrato ativado' : 'contrato desativado'); detalhesAlteracoes.push(`Contrato: ${atual.ativarContrato ? 'ativo' : 'inativo'} → ${ativarContrato ? 'ativo' : 'inativo'}.`) }
    if (novoMostrarAberta !== ((atual as any).mostrarAberta ?? true)) { changes.push(novoMostrarAberta ? 'aparece em excursões abertas' : 'oculta em excursões abertas'); detalhesAlteracoes.push(`Visibilidade pública: ${((atual as any).mostrarAberta ?? true) ? 'visível' : 'oculta'} → ${novoMostrarAberta ? 'visível' : 'oculta'}.`) }

    if (!atual.finalizada && finalizada) {
      await appendLog({ entity: 'excursao', action: 'finalize', title: 'Excursão finalizada', detail: adminDetail('finalizou uma excursão', [`Excursão: ${updated.nome}.`, `Destino: ${updated.lugar || 'não informado'}.`, `Data de finalização: ${new Date().toLocaleString('pt-BR')}.`, 'A viagem foi movida para a aba de excursões finalizadas.']) })
    } else if (changes.length) {
      const onlyExpenseRemoval = despesaDetalhes.length && changes.length === 1 && changes[0] === 'despesas' && despesaDetalhes.every((linha) => linha.startsWith('Despesa removida'))
      await appendLog({
        entity: despesaDetalhes.length || changes.some((change) => change.startsWith('pagamentos')) ? 'financeiro' : 'excursao',
        action: onlyExpenseRemoval ? 'expense-delete' : 'update',
        title: onlyExpenseRemoval ? 'Despesa removida' : (atual.finalizada ? 'Excursão finalizada atualizada' : 'Excursão atualizada'),
        detail: adminDetail(onlyExpenseRemoval ? 'removeu despesa de uma excursão' : 'editou uma excursão', [
          `Excursão: ${updated.nome}.`,
          `Destino: ${updated.lugar || 'não informado'}.`,
          `Campos alterados: ${changes.join(', ')}.`,
          ...detalhesAlteracoes,
          pagamentoDetalhes.length ? `Alterações de pagamento: ${pagamentoDetalhes.join(' | ')}` : null,
          despesaDetalhes.length ? `Alterações de despesas: ${despesaDetalhes.join(' | ')}` : null,
          `Status atual: ${updated.finalizada ? 'finalizada' : 'ativa'}.`
        ])
      })
    }

    return updated
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
