import pkg from '@prisma/client'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createCipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const __dirname = dirname(fileURLToPath(import.meta.url))
const filePath = process.env.SEED_FILE || process.env.SEED_USERS_FILE || join(__dirname, 'seed.example.json')

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function validCpf(value) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (length) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index)
    const result = 11 - (sum % 11)
    return result >= 10 ? 0 : result
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

const activeKeyVersion = Number(process.env.GRAZITUR_CPF_ACTIVE_KEY_VERSION || 1)
const protectionMode = String(process.env.GRAZITUR_CPF_PROTECTION_MODE || 'required')

function key(kind) {
  const name = `GRAZITUR_CPF_${kind}_KEY_V${activeKeyVersion}`
  const value = Buffer.from(String(process.env[name] || ''), 'base64')
  if (value.length !== 32) throw new Error(`Configuração segura ausente: ${name}`)
  return value
}

function blindIndex(cpf) {
  return `v${activeKeyVersion}:${createHmac('sha256', key('HMAC')).update(`grazitur:cpf:${cpf}`).digest('base64url')}`
}

function protectedCpf(cpf, existingContextId) {
  if (!cpf) return { cpf: null, cpfCiphertext: null, cpfBlindIndex: null, cpfKeyVersion: null, cpfLast4: null, cpfContextId: randomUUID() }
  const contextId = existingContextId || randomUUID()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key('ENCRYPTION'), iv, { authTagLength: 16 })
  cipher.setAAD(Buffer.from(`app=grazitur|entity=user|context=${contextId}|field=cpf|key_version=${activeKeyVersion}`, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(cpf, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    cpf: protectionMode === 'dual' ? cpf : null,
    cpfCiphertext: `grazitur-cpf.v1.${activeKeyVersion}.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`,
    cpfBlindIndex: blindIndex(cpf),
    cpfKeyVersion: activeKeyVersion,
    cpfLast4: cpf.slice(-4),
    cpfContextId: contextId
  }
}

const lookupKey = (cpf) => blindIndex(onlyDigits(cpf))

function safeJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function redactSensitiveText(value) {
  return String(value ?? '')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}[- ]?\d{2}\b/g, '[CPF REDIGIDO]')
    .replace(/\b\d{11}\b/g, '[IDENTIFICADOR REDIGIDO]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[E-MAIL REDIGIDO]')
}

function sanitizeSignatures(value) {
  const signatures = safeJson(value, {})
  if (!signatures || typeof signatures !== 'object' || Array.isArray(signatures)) return {}
  return Object.fromEntries(Object.entries(signatures).map(([entryKey, entryValue]) => {
    if (!entryValue || typeof entryValue !== 'object' || Array.isArray(entryValue)) return [entryKey, entryValue]
    const safe = { ...entryValue }
    for (const key of ['cpf', 'celular', 'email', 'rg', 'endereco', 'nascimento', 'guiaCpf', 'guiaCelular']) delete safe[key]
    return [entryKey, safe]
  }))
}

function normalUserPayload(user, existingContextId) {
  const cpf = onlyDigits(user.cpf)
  return {
    nome: String(user.nome || '').trim(),
    email: user.email ? String(user.email).trim() : null,
    ...protectedCpf(cpf, existingContextId),
    rg: user.rg ? String(user.rg).trim() : null,
    orgaoExpeditor: user.orgaoExpeditor ? String(user.orgaoExpeditor).trim() : null,
    nascimento: user.nascimento ? String(user.nascimento).trim() : null,
    celular: user.celular ? String(user.celular).trim() : null,
    cidade: user.cidade ? String(user.cidade).trim() : null,
    endereco: user.endereco ? String(user.endereco).trim() : null,
    idade: user.idade === null || user.idade === undefined || user.idade === '' ? null : Number(user.idade),
    isGuia: Boolean(user.isGuia)
  }
}

function collectFamilyReferences(user, originalIdToCpf) {
  const family = []
  for (const key of ['parentes', 'parentesDe']) {
    if (!Array.isArray(user[key])) continue
    for (const item of user[key]) {
      if (item && typeof item === 'object') {
        if (item.cpf) family.push(onlyDigits(item.cpf))
        else if (item.id && originalIdToCpf.has(Number(item.id))) family.push(originalIdToCpf.get(Number(item.id)))
      }
      if (typeof item === 'string' || typeof item === 'number') {
        const asId = Number(item)
        if (Number.isFinite(asId) && originalIdToCpf.has(asId)) family.push(originalIdToCpf.get(asId))
        else family.push(onlyDigits(item))
      }
    }
  }
  return [...new Set(family.filter(Boolean))]
}

async function importUsers(users) {
  const originalIdToCpf = new Map()
  for (const user of users) {
    if (user?.id && user?.cpf) originalIdToCpf.set(Number(user.id), onlyDigits(user.cpf))
  }

  const validUsers = users
    .map((user) => ({ sourceCpf: onlyDigits(user.cpf), user }))
    .filter((item) => String(item.user.nome || '').trim() && validCpf(item.sourceCpf))
  if (validUsers.length !== users.length) {
    throw new Error('Seed bloqueado: há cadastro sem nome ou com CPF ausente/inválido. Nenhum valor pessoal foi exibido.')
  }
  console.log(`Importando ${validUsers.length} passageiros...`)

  for (const item of validUsers) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ cpfBlindIndex: lookupKey(item.sourceCpf) }, { cpf: item.sourceCpf }] }, select: { id: true, cpfContextId: true } })
    const data = normalUserPayload(item.user, existing?.cpfContextId)
    if (existing) await prisma.user.update({ where: { id: existing.id }, data })
    else await prisma.user.create({ data })
  }

  const allDbUsers = await prisma.user.findMany({ select: { id: true, cpfBlindIndex: true } })
  const byCpf = new Map(allDbUsers.map((u) => [u.cpfBlindIndex, u]))

  for (const original of users) {
    const selfCpf = onlyDigits(original.cpf)
    const self = byCpf.get(lookupKey(selfCpf))
    if (!self) continue
    const familyCpfs = collectFamilyReferences(original, originalIdToCpf).filter((cpf) => cpf !== selfCpf)
    const familyIds = familyCpfs.map((cpf) => byCpf.get(lookupKey(cpf))?.id).filter(Boolean)
    await prisma.user.update({
      where: { id: self.id },
      data: { parentes: { set: familyIds.map((id) => ({ id })) } }
    })
  }
}

async function importExcursoes(excursoes) {
  if (!Array.isArray(excursoes) || !excursoes.length) return
  const users = await prisma.user.findMany({ select: { id: true, cpfBlindIndex: true } })
  const byCpf = new Map(users.map((u) => [u.cpfBlindIndex, u.id]))
  const knownUserIds = new Set(users.map((u) => Number(u.id)))
  const byOldId = new Map()
  for (const ex of excursoes) {
    for (const u of [...(ex.usuarios || []), ex.guia].filter(Boolean)) {
      const cpf = onlyDigits(u.cpf)
      if (u.id && cpf && byCpf.has(lookupKey(cpf))) byOldId.set(Number(u.id), byCpf.get(lookupKey(cpf)))
    }
  }

  console.log(`Importando ${excursoes.length} excursões...`)
  for (const ex of excursoes) {
    const guiaCpf = onlyDigits(ex.guiaCpf || ex.guia?.cpf)
    const guiaId = guiaCpf ? byCpf.get(lookupKey(guiaCpf)) : null
    const usuarioCpfs = Array.isArray(ex.usuarioCpfs) ? ex.usuarioCpfs : []
    const usuariosIds = (usuarioCpfs.length ? usuarioCpfs.map((cpf) => ({ cpf })) : (ex.usuarios || []))
      .map((u) => byCpf.get(lookupKey(onlyDigits(u.cpf || u))) || byOldId.get(Number(u.id)))
      .filter(Boolean)

    const rawWaitlist = safeJson(ex.listaEsperaJson, ex.listaEspera || [])
    const safeWaitlist = Array.isArray(rawWaitlist) ? rawWaitlist.map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const oldUserId = Number(entry.userId)
      const cpf = onlyDigits(entry.cpf)
      const userId = byOldId.get(oldUserId)
        || (knownUserIds.has(oldUserId) ? oldUserId : null)
        || (cpf ? byCpf.get(lookupKey(cpf)) : null)
      if (!userId) return null
      return {
        id: String(entry.id || randomUUID()),
        userId,
        createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString(),
        origem: 'Importação de seed'
      }
    }).filter(Boolean) : []

    const rawSignatures = ex.assinaturasJson === undefined ? ex.assinaturas : ex.assinaturasJson
    const safeSignatures = sanitizeSignatures(rawSignatures)

    const payload = {
      nome: String(ex.nome || ''),
      lugar: String(ex.lugar || ''),
      vagas: Number(ex.vagas || 0),
      valores: typeof ex.valores === 'string' ? ex.valores : JSON.stringify(ex.valores || []),
      guiaId: guiaId || null,
      ativarContrato: Boolean(ex.ativarContrato),
      aplicarParcelas: ex.aplicarParcelas === undefined ? true : Boolean(ex.aplicarParcelas),
      pagamentosJson: typeof ex.pagamentosJson === 'string' ? ex.pagamentosJson : JSON.stringify(ex.pagamentos || {}),
      contratoDetalhes: typeof ex.contratoDetalhes === 'string' ? ex.contratoDetalhes : JSON.stringify(ex.detalhes || {}),
      contratoGrupos: typeof ex.contratoGrupos === 'string' ? ex.contratoGrupos : JSON.stringify(ex.grupos || {}),
      liberarContratos: ex.liberarContratos === undefined ? Boolean(ex.ativarContrato) : Boolean(ex.liberarContratos),
      assinaturasJson: JSON.stringify(safeSignatures),
      despesasJson: typeof ex.despesasJson === 'string' ? ex.despesasJson : JSON.stringify(ex.despesas || []),
      listaEsperaJson: JSON.stringify(safeWaitlist),
      mostrarAberta: ex.mostrarAberta === undefined ? true : Boolean(ex.mostrarAberta),
      finalizada: Boolean(ex.finalizada),
      finalizadaEm: ex.finalizadaEm ? new Date(ex.finalizadaEm) : null
    }

    const created = await prisma.excursao.create({ data: payload })
    if (usuariosIds.length) {
      await prisma.excursao.update({ where: { id: created.id }, data: { usuarios: { connect: usuariosIds.map((id) => ({ id })) } } })
    }
  }
}


async function importLogs(logs) {
  if (!Array.isArray(logs) || !logs.length) return
  console.log(`Importando ${logs.length} logs do sistema...`)
  for (const log of logs) {
    const id = String(log.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    const data = {
      createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
      entity: String(log.entity || 'sistema'),
      action: String(log.action || 'manual'),
      title: String(log.title || 'Registro importado'),
      detail: log.detail ? redactSensitiveText(log.detail) : null
    }
    await prisma.systemLog.upsert({ where: { id }, update: data, create: { id, ...data } })
  }
}

async function main() {
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  const users = Array.isArray(parsed) ? parsed : (parsed.users || parsed.usuarios || [])
  const excursoes = Array.isArray(parsed) ? [] : (parsed.excursoes || [])
  const logs = Array.isArray(parsed) ? [] : (parsed.logs || [])
  if (process.env.SEED_RESET === 'true') {
    console.log('SEED_RESET=true: limpando excursões e logs antes de importar...')
    await prisma.excursao.deleteMany()
    await prisma.systemLog.deleteMany()
  }
  if (!Array.isArray(users)) throw new Error('O seed precisa ter um array de usuários em users ou ser um array direto.')
  await importUsers(users)
  await importExcursoes(excursoes)
  await importLogs(logs)
  console.log('Seed finalizado com sucesso!')
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
