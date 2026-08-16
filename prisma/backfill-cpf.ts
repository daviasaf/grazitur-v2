import pkg from '@prisma/client'
import { buildCpfWriteFields, cpfProtectionMode, isValidCpf } from '../server/utils/cpf-security.ts'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const BATCH_SIZE = Math.max(1, Math.min(500, Number(process.env.CPF_BACKFILL_BATCH_SIZE || 100)))
const APPLY = process.env.CPF_BACKFILL_APPLY === 'true'

async function main() {
  const pending = await prisma.user.count({
    where: {
      cpf: { not: null },
      OR: [
        { cpfCiphertext: null },
        { cpfBlindIndex: null },
        { cpfKeyVersion: null },
        { cpfContextId: null }
      ]
    }
  })
  console.log(`Backfill de CPF: ${pending} registro(s) pendente(s).`)
  if (!APPLY) {
    console.log('Somente diagnóstico. Defina CPF_BACKFILL_APPLY=true após aprovação e restauração comprovada.')
    return
  }
  if (cpfProtectionMode() !== 'dual') {
    throw new Error('O backfill só pode ser aplicado com GRAZITUR_CPF_PROTECTION_MODE=dual para preservar o rollback.')
  }

  let processed = 0
  let lastId = 0
  while (true) {
    const batch = await prisma.user.findMany({
      where: {
        id: { gt: lastId },
        cpf: { not: null },
        OR: [
          { cpfCiphertext: null },
          { cpfBlindIndex: null },
          { cpfKeyVersion: null },
          { cpfContextId: null }
        ]
      },
      select: { id: true, cpf: true, cpfContextId: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE
    })
    if (!batch.length) break

    for (const item of batch) {
      lastId = item.id
      if (!item.cpf || !isValidCpf(item.cpf)) {
        console.error(`Registro técnico ${item.id}: CPF ausente ou inválido; encaminhar para quarentena antes do cutover.`)
        continue
      }
      const fields = buildCpfWriteFields(item.cpf, item.cpfContextId)
      const result = await prisma.user.updateMany({
        where: {
          id: item.id,
          OR: [
            { cpfCiphertext: null },
            { cpfBlindIndex: null },
            { cpfKeyVersion: null },
            { cpfContextId: null }
          ]
        },
        data: fields
      })
      processed += result.count
    }
    console.log(`Lote concluído. Processados até agora: ${processed}. Último ID técnico: ${lastId}.`)
  }

  const remaining = await prisma.user.count({
    where: {
      cpf: { not: null },
      OR: [
        { cpfCiphertext: null },
        { cpfBlindIndex: null },
        { cpfKeyVersion: null },
        { cpfContextId: null }
      ]
    }
  })
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
