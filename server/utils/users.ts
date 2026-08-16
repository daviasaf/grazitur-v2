import * as z from 'zod'
import { formatarNome, validarCPF } from '../../app/utils/formatadores'
import { uniqueIds } from './json'
import { buildCpfWriteFields, cpfBlindIndexes, cpfProtectionMode, getPlainCpf, maskCpf, normalizeCpf } from './cpf-security'
import { prisma } from './prisma'

export const formatNameServer = formatarNome

function publicUserFields(user: Record<string, any>, revealCpf: boolean) {
  const cpf = getPlainCpf(user)
  const {
    cpfCiphertext: _cpfCiphertext,
    cpfBlindIndex: _cpfBlindIndex,
    cpfKeyVersion: _cpfKeyVersion,
    cpfContextId: _cpfContextId,
    ...safe
  } = user
  return {
    ...safe,
    cpf: revealCpf ? cpf : maskCpf(cpf),
    cpfMasked: maskCpf(cpf),
    cpfLast4: user.cpfLast4 || cpf.slice(-4) || null
  }
}

export function normalizeUser(user: Record<string, unknown>, options: { revealCpf?: boolean } = {}) {
  const revealCpf = Boolean(options.revealCpf)
  const parentes = Array.isArray(user.parentes) ? user.parentes as Array<Record<string, unknown>> : []
  const parentesDe = Array.isArray(user.parentesDe) ? user.parentesDe as Array<Record<string, unknown>> : []
  const mapa = new Map<number, Record<string, unknown>>()
  for (const p of [...parentes, ...parentesDe]) {
    const id = Number(p.id)
    if (Number.isFinite(id) && id !== Number(user.id)) mapa.set(id, p)
  }
  return {
    ...publicUserFields(user, revealCpf),
    parentes: [...mapa.values()].map((relative) => publicUserFields(relative, revealCpf)),
    parentesDe: parentesDe.map((relative) => publicUserFields(relative, revealCpf))
  }
}

export async function findUserByCpf(cpfValue: unknown, options: Record<string, unknown> = {}) {
  const cpf = normalizeCpf(cpfValue)
  if (!validarCPF(cpf)) return null

  let blindIndexes: string[] = []
  try {
    blindIndexes = cpfProtectionMode() === 'disabled' ? [] : cpfBlindIndexes(cpf)
  } catch (error) {
    if (cpfProtectionMode() === 'required') throw error
  }

  const where = blindIndexes.length
    ? { OR: [{ cpfBlindIndex: { in: blindIndexes } }, { cpf }] }
    : { cpf }
  return await prisma.user.findFirst({ ...options, where } as any)
}

export function protectedCpfData(cpfValue: unknown, existingContextId?: string | null) {
  return buildCpfWriteFields(cpfValue, existingContextId)
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

    if (cpfLimpo && !validarCPF(cpfLimpo)) {
      throw createError({ statusCode: 400, statusMessage: 'CPF inválido. Deixe o campo vazio se o cadastro ainda não tiver documento.' })
    }

    return {
      nome,
      email: body.email ? String(body.email).trim() : null,
      cpf: cpfLimpo || null,
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
