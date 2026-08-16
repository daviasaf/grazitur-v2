import { prisma } from '../utils/prisma'
import { findUserByCpf, normalizeUser, formatNameServer, parentesIdsFromBody, protectedCpfData, validateUserPayload } from '../utils/users'
import { appendLog, adminDetail, buildDetail } from '../utils/logs'
import { getAdminSession } from '../utils/admin-auth'
import { requirePassengerSession, setPassengerSession } from '../utils/passenger-auth'

const includeFamily = { parentes: true, parentesDe: true }

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const users = await prisma.user.findMany({ include: includeFamily, orderBy: { createdAt: 'desc' } })
    return users.map((u) => normalizeUser(u))
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const admin = await getAdminSession(event)
    const hasOwn = (field: string) => Object.prototype.hasOwnProperty.call(body, field)
    if (!admin && ['skipValidation', 'salvarSemValidacao', 'isGuia', 'parentesIds'].some(hasOwn)) {
      throw createError({ statusCode: 403, statusMessage: 'Campo administrativo não autorizado no cadastro público.' })
    }
    const valid = validateUserPayload(body)
    const parentesIds = parentesIdsFromBody(body)
    if (valid.cpf && await findUserByCpf(valid.cpf)) {
      throw createError({ statusCode: 400, statusMessage: 'Este CPF já está cadastrado no sistema.' })
    }

    const cpfFamiliar = String(body.cpfFamiliar || '').replace(/\D/g, '')
    if (cpfFamiliar) {
      const familiar = await findUserByCpf(cpfFamiliar)
      if (!familiar) throw createError({ statusCode: 404, statusMessage: 'Familiar responsável não encontrado.' })
      if (!admin) requirePassengerSession(event, familiar.id)
      parentesIds.push(familiar.id)
    }

    try {
      const user = await prisma.user.create({
        data: {
          nome: formatNameServer(valid.nome),
          email: valid.email,
          ...protectedCpfData(valid.cpf),
          rg: valid.rg ? String(valid.rg) : null,
          orgaoExpeditor: valid.orgaoExpeditor,
          nascimento: valid.nascimento,
          celular: valid.celular,
          cidade: valid.cidade,
          endereco: valid.endereco,
          idade: valid.idade,
          isGuia: Boolean(valid.isGuia),
          parentes: { connect: [...new Set(parentesIds)].map((id) => ({ id })) }
        },
        include: includeFamily
      })
      if (!admin) setPassengerSession(event, user.id)
      const logLines = [`Passageiro ID: ${user.id}.`, Boolean(body.skipValidation || body.salvarSemValidacao) ? 'Cadastro incompleto autorizado.' : null, Boolean(user.isGuia) ? 'Cadastro marcado como guia.' : 'Cadastro de passageiro comum.', parentesIds.length ? `Vínculos familiares: ${parentesIds.length}.` : 'Sem vínculos familiares no cadastro inicial.']
      await appendLog({
        entity: 'user',
        action: 'create',
        title: 'Novo passageiro cadastrado',
        detail: admin ? adminDetail('cadastrou um passageiro', logLines) : buildDetail(['Responsável: Passageiro.', 'Ação: enviou cadastro público.', ...logLines])
      })
      return normalizeUser(user)
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'P2002') {
        throw createError({ statusCode: 400, statusMessage: 'Este CPF já está cadastrado no sistema.' })
      }
      throw err
    }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
