import { prisma } from '../utils/prisma'
import { normalizeUser, formatNameServer, parentesIdsFromBody, validateUserPayload } from '../utils/users'
import { appendLog, adminDetail } from '../utils/logs'

const includeFamily = { parentes: true, parentesDe: true }

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const users = await prisma.user.findMany({ include: includeFamily, orderBy: { createdAt: 'desc' } })
    return users.map((u) => normalizeUser(u))
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const valid = validateUserPayload(body)
    const parentesIds = parentesIdsFromBody(body)

    const cpfFamiliar = String(body.cpfFamiliar || '').replace(/\D/g, '')
    if (cpfFamiliar) {
      const familiar = await prisma.user.findUnique({ where: { cpf: cpfFamiliar } })
      if (familiar) parentesIds.push(familiar.id)
    }

    try {
      const user = await prisma.user.create({
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
          parentes: { connect: [...new Set(parentesIds)].map((id) => ({ id })) }
        },
        include: includeFamily
      })
      await appendLog({ entity: 'user', action: 'create', title: 'Novo passageiro cadastrado', detail: adminDetail('cadastrou um passageiro', [`Passageiro: ${user.nome}.`, `CPF: ${user.cpf}.`, `Celular: ${user.celular || 'não informado'}.`, `Cidade: ${user.cidade || 'não informada'}.`, Boolean(body.skipValidation || body.salvarSemValidacao) ? 'Cadastro salvo pelo Admin sem exigir todos os campos obrigatórios.' : null, Boolean(user.isGuia) ? 'Cadastro marcado como guia.' : 'Cadastro de passageiro comum.', parentesIds.length ? `Vinculado como familiar de ${parentesIds.length} cadastro(s).` : 'Sem familiares vinculados no cadastro inicial.']) })
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
