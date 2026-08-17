import pkg from '@prisma/client'
import { buildPersonalDataWriteFields, piiProtectionMode } from '../server/utils/pii-security.ts'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const BATCH_SIZE = Math.max(1, Math.min(500, Number(process.env.PII_BACKFILL_BATCH_SIZE || 100)))
const APPLY = process.env.PII_BACKFILL_APPLY === 'true'

const pendingWhere = {
  OR: [
    { piiCiphertext: null },
    { piiKeyVersion: null },
    { piiContextId: null }
  ]
}

async function main() {
  const pending = await prisma.user.count({ where: pendingWhere })
  console.log(`Backfill de dados pessoais: ${pending} registro(s) pendente(s).`)
  if (!APPLY) {
    console.log('Somente diagnóstico. Defina PII_BACKFILL_APPLY=true após aprovação e restauração comprovada.')
    return
  }
  if (piiProtectionMode() !== 'dual') {
    throw new Error('O backfill só pode ser aplicado com GRAZITUR_PII_PROTECTION_MODE=dual para preservar o rollback.')
  }

  let processed = 0
  let lastId = 0
  while (true) {
    const batch = await prisma.user.findMany({
      where: { id: { gt: lastId }, ...pendingWhere },
      select: {
        id: true,
        nome: true,
        email: true,
        rg: true,
        orgaoExpeditor: true,
        nascimento: true,
        celular: true,
        cidade: true,
        endereco: true,
        idade: true,
        piiContextId: true
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE
    })
    if (!batch.length) break

    for (const item of batch) {
      lastId = item.id
      if (!item.nome || item.nome.trim().length < 2) {
        console.error(`Registro técnico ${item.id}: nome ausente; encaminhar para quarentena antes do cutover.`)
        continue
      }
      const fields = buildPersonalDataWriteFields({
        nome: item.nome,
        email: item.email,
        rg: item.rg,
        orgaoExpeditor: item.orgaoExpeditor,
        nascimento: item.nascimento,
        celular: item.celular,
        cidade: item.cidade,
        endereco: item.endereco,
        idade: item.idade
      }, item.piiContextId)
      const result = await prisma.user.updateMany({
        where: { id: item.id, ...pendingWhere },
        data: fields
      })
      processed += result.count
    }
    console.log(`Lote concluído. Processados até agora: ${processed}. Último ID técnico: ${lastId}.`)
  }

  const remaining = await prisma.user.count({ where: pendingWhere })
  console.log(`Backfill concluído. Processados: ${processed}. Pendentes: ${remaining}.`)
  if (remaining) process.exitCode = 2
}

main()
  .catch((error: unknown) => {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || 'sem-código') : 'sem-código'
    console.error(`Backfill interrompido sem exibir dados pessoais. Código técnico: ${code}.`)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
