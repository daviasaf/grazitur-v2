import pkg from '@prisma/client'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const __dirname = dirname(fileURLToPath(import.meta.url))
const filePath = process.env.SEED_FILE || process.env.SEED_USERS_FILE || join(__dirname, 'seed-users.json')

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function safeJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function normalUserPayload(user) {
  return {
    nome: String(user.nome || '').trim(),
    email: user.email ? String(user.email).trim() : null,
    cpf: onlyDigits(user.cpf),
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

  const validUsers = users.map(normalUserPayload).filter((u) => u.nome && u.cpf)
  console.log(`Importando ${validUsers.length} passageiros...`)

  for (const data of validUsers) {
    await prisma.user.upsert({ where: { cpf: data.cpf }, update: data, create: data })
  }

  const allDbUsers = await prisma.user.findMany({ select: { id: true, cpf: true } })
  const byCpf = new Map(allDbUsers.map((u) => [u.cpf, u]))

  for (const original of users) {
    const selfCpf = onlyDigits(original.cpf)
    const self = byCpf.get(selfCpf)
    if (!self) continue
    const familyCpfs = collectFamilyReferences(original, originalIdToCpf).filter((cpf) => cpf !== selfCpf)
    const familyIds = familyCpfs.map((cpf) => byCpf.get(cpf)?.id).filter(Boolean)
    await prisma.user.update({
      where: { id: self.id },
      data: { parentes: { set: familyIds.map((id) => ({ id })) } }
    })
  }
}

async function importExcursoes(excursoes) {
  if (!Array.isArray(excursoes) || !excursoes.length) return
  const users = await prisma.user.findMany({ select: { id: true, cpf: true } })
  const byCpf = new Map(users.map((u) => [u.cpf, u.id]))
  const byOldId = new Map()
  for (const ex of excursoes) {
    for (const u of [...(ex.usuarios || []), ex.guia].filter(Boolean)) {
      const cpf = onlyDigits(u.cpf)
      if (u.id && cpf && byCpf.has(cpf)) byOldId.set(Number(u.id), byCpf.get(cpf))
    }
  }

  console.log(`Importando ${excursoes.length} excursões...`)
  for (const ex of excursoes) {
    const guiaCpf = onlyDigits(ex.guiaCpf || ex.guia?.cpf)
    const guiaId = guiaCpf ? byCpf.get(guiaCpf) : null
    const usuarioCpfs = Array.isArray(ex.usuarioCpfs) ? ex.usuarioCpfs : []
    const usuariosIds = (usuarioCpfs.length ? usuarioCpfs.map((cpf) => ({ cpf })) : (ex.usuarios || []))
      .map((u) => byCpf.get(onlyDigits(u.cpf || u)) || byOldId.get(Number(u.id)))
      .filter(Boolean)

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
      assinaturasJson: typeof ex.assinaturasJson === 'string' ? ex.assinaturasJson : JSON.stringify(ex.assinaturas || {}),
      despesasJson: typeof ex.despesasJson === 'string' ? ex.despesasJson : JSON.stringify(ex.despesas || []),
      listaEsperaJson: typeof ex.listaEsperaJson === 'string' ? ex.listaEsperaJson : JSON.stringify(ex.listaEspera || []),
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
      detail: log.detail ? String(log.detail) : null
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
