import * as z from 'zod'
import { formatarNome, validarCPF } from '../../app/utils/formatadores'
import { uniqueIds } from './json'

export const formatNameServer = formatarNome

export function normalizeUser(user: Record<string, unknown>) {
  const parentes = Array.isArray(user.parentes) ? user.parentes as Array<Record<string, unknown>> : []
  const parentesDe = Array.isArray(user.parentesDe) ? user.parentesDe as Array<Record<string, unknown>> : []
  const mapa = new Map<number, Record<string, unknown>>()
  for (const p of [...parentes, ...parentesDe]) {
    const id = Number(p.id)
    if (Number.isFinite(id) && id !== Number(user.id)) mapa.set(id, p)
  }
  return { ...user, parentes: [...mapa.values()], parentesDe }
}

export function parentesIdsFromBody(body: Record<string, unknown>, selfId?: number) {
  const raw = Array.isArray(body.parentesIds) ? body.parentesIds as Array<number | string> : []
  return uniqueIds(raw, selfId)
}

const userBodySchema = z.object({
  nome: z.string().trim().min(2, 'Nome completo é obrigatório.'),
  email: z.string().trim().email('E-mail inválido.'),
  cpf: z.string().refine((v) => validarCPF(v), 'CPF inválido.'),
  orgaoExpeditor: z.string().trim().min(1, 'Órgão expeditor é obrigatório.'),
  nascimento: z.string().trim().min(10, 'Nascimento é obrigatório.'),
  celular: z.string().trim().min(8, 'Celular é obrigatório.'),
  cidade: z.string().trim().min(3, 'Cidade e estado são obrigatórios.'),
  endereco: z.string().trim().min(3, 'Endereço é obrigatório.'),
  idade: z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number({ error: 'Idade é obrigatória.' }).min(0, 'Idade inválida.')),
  rg: z.string().optional().nullable(),
  isGuia: z.boolean().optional()
})

export function validateUserPayload(body: Record<string, unknown>) {
  const skipValidation = Boolean(body.skipValidation || body.salvarSemValidacao)
  const cpfLimpo = String(body.cpf || '').replace(/\D/g, '')

  if (skipValidation) {
    const nome = String(body.nome || '').trim()
    if (nome.length < 2) {
      throw createError({ statusCode: 400, statusMessage: 'Informe pelo menos o nome do passageiro.' })
    }

    return {
      nome,
      email: body.email ? String(body.email).trim() : null,
      cpf: cpfLimpo || `TEMP${Date.now()}`,
      rg: body.rg ? String(body.rg) : null,
      orgaoExpeditor: body.orgaoExpeditor ? String(body.orgaoExpeditor) : null,
      nascimento: body.nascimento ? String(body.nascimento) : null,
      celular: body.celular ? String(body.celular) : null,
      cidade: body.cidade ? String(body.cidade) : null,
      endereco: body.endereco ? String(body.endereco) : null,
      idade: body.idade === '' || body.idade === null || body.idade === undefined ? null : Number(body.idade),
      isGuia: Boolean(body.isGuia)
    }
  }

  const result = userBodySchema.safeParse({
    ...body,
    cpf: cpfLimpo
  })

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error.issues[0]?.message || 'Dados inválidos.' })
  }

  return result.data
}
