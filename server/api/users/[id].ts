import { prisma } from '../../utils/prisma'
import { normalizeUser, formatNameServer, parentesIdsFromBody, validateUserPayload } from '../../utils/users'
import { appendLog, adminDetail } from '../../utils/logs'
import { parseJson } from '../../utils/json'

const includeFamily = { parentes: true, parentesDe: true }

const fmt = (v: unknown) => String(v ?? 'não informado')
const changedLine = (label: string, before: unknown, after: unknown) => String(before ?? '') !== String(after ?? '') ? `${label}: ${fmt(before)} → ${fmt(after)}.` : null

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const method = getMethod(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })

  if (method === 'GET') {
    const user = await prisma.user.findUnique({ where: { id }, include: includeFamily })
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Passageiro não encontrado.' })
    return normalizeUser(user)
  }

  if (method === 'DELETE') {
    const atual = await prisma.user.findUnique({ where: { id }, include: { parentes: true, parentesDe: true, excursoes: true, excursoesGuia: true } })
    if (!atual) throw createError({ statusCode: 404, statusMessage: 'Passageiro não encontrado.' })

    const excursoes = await prisma.excursao.findMany({ include: { usuarios: true } })
    const excursaoAfetadas: string[] = []

    for (const ex of excursoes) {
      const pagamentos = parseJson<Record<string, string>>(ex.pagamentosJson, {})
      const grupos = parseJson<Record<string, string[]>>(ex.contratoGrupos, {})
      const assinaturas = parseJson<Record<string, any>>(ex.assinaturasJson, {})
      const listaOriginal = parseJson<any[]>(ex.listaEsperaJson, [])
      const cpfAtual = String(atual.cpf || '').replace(/\D/g, '')

      let mudou = false
      if (pagamentos[String(id)]) { delete pagamentos[String(id)]; mudou = true }
      if (assinaturas[String(id)]) { delete assinaturas[String(id)]; mudou = true }
      if (assinaturas[`admin_${id}`]) { delete assinaturas[`admin_${id}`]; mudou = true }
      if (grupos[String(id)]) { delete grupos[String(id)]; mudou = true }
      for (const liderId of Object.keys(grupos)) {
        const antes = grupos[liderId] || []
        grupos[liderId] = antes.filter((depId: any) => String(depId) !== String(id))
        if (grupos[liderId].length !== antes.length) mudou = true
        if (!grupos[liderId].length) delete grupos[liderId]
      }
      const lista = listaOriginal.filter((item: any) => Number(item.userId) !== id && String(item.cpf || '').replace(/\D/g, '') !== cpfAtual)
      if (lista.length !== listaOriginal.length) mudou = true
      const conectado = ex.usuarios.some((u) => Number(u.id) === id)
      const guia = Number(ex.guiaId) === id
      if (conectado || guia || mudou) excursaoAfetadas.push(ex.nome)

      await prisma.excursao.update({
        where: { id: ex.id },
        data: {
          ...(conectado ? { usuarios: { disconnect: { id } } } : {}),
          ...(guia ? { guiaId: null } : {}),
          pagamentosJson: JSON.stringify(pagamentos),
          contratoGrupos: JSON.stringify(grupos),
          assinaturasJson: JSON.stringify(assinaturas),
          listaEsperaJson: JSON.stringify(lista)
        }
      })
    }

    const parentesRelacionados = [...(atual.parentes || []), ...(atual.parentesDe || [])]
    for (const parente of parentesRelacionados) {
      await prisma.user.update({ where: { id: parente.id }, data: { parentes: { disconnect: { id } } } }).catch(() => null)
    }

    await prisma.user.delete({ where: { id } })
    await appendLog({ entity: 'user', action: 'delete', title: 'Passageiro excluído', detail: adminDetail('apagou um passageiro do sistema', [`Passageiro: ${atual.nome}.`, `CPF: ${atual.cpf}.`, excursaoAfetadas.length ? `Removido das excursões/listas: ${[...new Set(excursaoAfetadas)].join(', ')}.` : 'Não havia vínculos ativos em excursões ou lista de espera.', parentesRelacionados.length ? `Vínculos familiares removidos: ${parentesRelacionados.length}.` : 'Não havia vínculos familiares.']) })
    return { success: true }
  }

  if (method === 'PUT') {
    const body = await readBody<Record<string, unknown>>(event)
    const valid = validateUserPayload(body)
    const hasParentesIds = Array.isArray(body.parentesIds)
    const parentesIds = hasParentesIds ? parentesIdsFromBody(body, id) : []

    const atual = await prisma.user.findUnique({ where: { id } })
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          nome: formatNameServer(valid.nome),
          email: valid.email,
          cpf: String(valid.cpf).startsWith('TEMP') ? String(valid.cpf) : String(valid.cpf).replace(/\D/g, ''),
          rg: valid.rg ? String(valid.rg) : null,
          orgaoExpeditor: valid.orgaoExpeditor,
          nascimento: valid.nascimento,
          celular: valid.celular,
          cidade: valid.cidade,
          endereco: valid.endereco,
          idade: valid.idade,
          isGuia: Boolean(valid.isGuia),
          ...(hasParentesIds ? { parentes: { set: parentesIds.map((pid) => ({ id: pid })) } } : {})
        },
        include: includeFamily
      })

      await appendLog({
        entity: 'user',
        action: 'update',
        title: 'Cadastro atualizado',
        detail: adminDetail('editou cadastro de passageiro', [
          `Passageiro: ${atual?.nome || user.nome}.`,
          changedLine('Nome', atual?.nome, user.nome),
          changedLine('E-mail', atual?.email, user.email),
          changedLine('CPF', atual?.cpf, user.cpf),
          changedLine('Celular', atual?.celular, user.celular),
          changedLine('Cidade', atual?.cidade, user.cidade),
          changedLine('Endereço', atual?.endereco, user.endereco),
          changedLine('Idade', atual?.idade, user.idade),
          changedLine('Guia', atual?.isGuia ? 'sim' : 'não', user.isGuia ? 'sim' : 'não'),
          Boolean(body.skipValidation || body.salvarSemValidacao) ? 'Cadastro salvo pelo Admin sem exigir todos os campos obrigatórios.' : null,
          hasParentesIds ? `Familiares vinculados agora: ${parentesIds.length}.` : 'Vínculos familiares mantidos.'
        ])
      })
      return normalizeUser(user)
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'P2002') {
        throw createError({ statusCode: 400, statusMessage: 'Já existe um passageiro cadastrado com este CPF.' })
      }
      throw err
    }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
