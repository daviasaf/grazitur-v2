import { prisma } from '../../utils/prisma'
import { findUserByCpf, normalizeUser, formatNameServer, parentesIdsFromBody, protectedCpfData, validateUserPayload } from '../../utils/users'
import { appendLog, adminDetail, buildDetail } from '../../utils/logs'
import { parseJson } from '../../utils/json'
import { getAdminSession } from '../../utils/admin-auth'
import { requirePassengerSession } from '../../utils/passenger-auth'
import { getPlainCpf } from '../../utils/cpf-security'

const includeFamily = { parentes: true, parentesDe: true }

const changedField = (label: string, before: unknown, after: unknown) => String(before ?? '') !== String(after ?? '') ? label : null

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const method = getMethod(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })

  if (method === 'GET') {
    const user = await prisma.user.findUnique({ where: { id }, include: includeFamily })
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Passageiro não encontrado.' })
    const revealCpf = String(getQuery(event).reveal || '') === 'cpf'
    if (revealCpf) {
      setResponseHeader(event, 'Cache-Control', 'no-store')
      await appendLog({ entity: 'privacy', action: 'cpf-reveal', title: 'CPF revelado para edição administrativa', detail: adminDetail('revelou um CPF', [`Passageiro ID: ${id}.`, 'Finalidade: edição cadastral.']) })
    }
    return normalizeUser(user, { revealCpf })
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
      const lista = listaOriginal.filter((item: any) => Number(item.userId) !== id)
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
    await appendLog({ entity: 'user', action: 'delete', title: 'Passageiro excluído', detail: adminDetail('apagou um passageiro do sistema', [`Passageiro ID: ${id}.`, excursaoAfetadas.length ? `Removido das excursões/listas: ${[...new Set(excursaoAfetadas)].join(', ')}.` : 'Não havia vínculos ativos em excursões ou lista de espera.', parentesRelacionados.length ? `Vínculos familiares removidos: ${parentesRelacionados.length}.` : 'Não havia vínculos familiares.']) })
    return { success: true }
  }

  if (method === 'PUT') {
    const body = await readBody<Record<string, unknown>>(event)
    const admin = await getAdminSession(event)
    if (!admin) {
      requirePassengerSession(event, id)
      const hasOwn = (field: string) => Object.prototype.hasOwnProperty.call(body, field)
      if (['skipValidation', 'salvarSemValidacao', 'isGuia', 'parentesIds'].some(hasOwn)) {
        throw createError({ statusCode: 403, statusMessage: 'Alteração administrativa não autorizada.' })
      }
    }
    const valid = validateUserPayload(body)
    const hasParentesIds = Array.isArray(body.parentesIds)
    const parentesIds = hasParentesIds ? parentesIdsFromBody(body, id) : []

    const atual = await prisma.user.findUnique({ where: { id } })
    if (!atual) throw createError({ statusCode: 404, statusMessage: 'Passageiro não encontrado.' })
    const cpfAntes = getPlainCpf(atual)
    const duplicate = valid.cpf ? await findUserByCpf(valid.cpf) : null
    if (duplicate && duplicate.id !== id) throw createError({ statusCode: 400, statusMessage: 'Já existe um passageiro cadastrado com este CPF.' })
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          nome: formatNameServer(valid.nome),
          email: valid.email,
          ...protectedCpfData(valid.cpf, atual.cpfContextId),
          rg: valid.rg ? String(valid.rg) : null,
          orgaoExpeditor: valid.orgaoExpeditor,
          nascimento: valid.nascimento,
          celular: valid.celular,
          cidade: valid.cidade,
          endereco: valid.endereco,
          idade: valid.idade,
          isGuia: admin ? Boolean(valid.isGuia) : atual.isGuia,
          ...(hasParentesIds ? { parentes: { set: parentesIds.map((pid) => ({ id: pid })) } } : {})
        },
        include: includeFamily
      })

      const changedFields = [
        changedField('nome', atual.nome, user.nome),
        changedField('e-mail', atual.email, user.email),
        changedField('CPF', cpfAntes, getPlainCpf(user)),
        changedField('RG', atual.rg, user.rg),
        changedField('órgão expedidor', atual.orgaoExpeditor, user.orgaoExpeditor),
        changedField('nascimento', atual.nascimento, user.nascimento),
        changedField('celular', atual.celular, user.celular),
        changedField('cidade', atual.cidade, user.cidade),
        changedField('endereço', atual.endereco, user.endereco),
        changedField('idade', atual.idade, user.idade),
        changedField('perfil de guia', atual.isGuia, user.isGuia)
      ].filter(Boolean)
      const logLines = [
        `Passageiro ID: ${id}.`,
        changedFields.length ? `Campos alterados: ${changedFields.join(', ')}.` : 'Nenhum valor cadastral foi alterado.',
        Boolean(body.skipValidation || body.salvarSemValidacao) ? 'Cadastro incompleto autorizado.' : null,
        hasParentesIds ? `Vínculos familiares atuais: ${parentesIds.length}.` : 'Vínculos familiares mantidos.'
      ]
      await appendLog({
        entity: 'user',
        action: 'update',
        title: 'Cadastro atualizado',
        detail: admin ? adminDetail('editou cadastro de passageiro', logLines) : buildDetail(['Responsável: Passageiro.', 'Ação: editou o próprio cadastro.', ...logLines])
      })
      return normalizeUser(user, { revealCpf: !admin })
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
