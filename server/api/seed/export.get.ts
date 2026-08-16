import { prisma } from '../../utils/prisma'
import { parseJson } from '../../utils/json'
import { readLogs } from '../../utils/logs'
import { appendLog, adminDetail } from '../../utils/logs'
import { normalizeUser } from '../../utils/users'

export default defineEventHandler(async (event) => {
  if (process.env.GRAZITUR_ENABLE_SENSITIVE_EXPORT !== 'true') {
    throw createError({ statusCode: 403, statusMessage: 'Export de dados pessoais desabilitado por configuração.' })
  }
  const purpose = String(getQuery(event).purpose || '').trim()
  if (purpose.length < 8) throw createError({ statusCode: 400, statusMessage: 'Informe uma finalidade autorizada para o export.' })
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const logs = await readLogs()
  const usuarios = await prisma.user.findMany({
    include: { parentes: true, parentesDe: true },
    orderBy: { nome: 'asc' }
  })

  const excursoesDb = await prisma.excursao.findMany({
    include: { usuarios: true, guia: true },
    orderBy: [{ finalizada: 'asc' }, { createdAt: 'desc' }]
  })

  const safeUsers = usuarios.map((user) => normalizeUser(user, { revealCpf: true }))
  const excursoes = excursoesDb.map((ex) => ({
    ...ex,
    valores: parseJson(ex.valores, []),
    pagamentos: parseJson(ex.pagamentosJson, {}),
    detalhes: parseJson(ex.contratoDetalhes, {}),
    grupos: parseJson(ex.contratoGrupos, {}),
    assinaturas: parseJson(ex.assinaturasJson, {}),
    despesas: parseJson(ex.despesasJson, []),
    listaEspera: parseJson(ex.listaEsperaJson, []),
    usuarios: ex.usuarios.map((user) => normalizeUser(user, { revealCpf: true })),
    guia: ex.guia ? normalizeUser(ex.guia, { revealCpf: true }) : null,
    usuarioCpfs: ex.usuarios.map((user) => normalizeUser(user, { revealCpf: true }).cpf),
    guiaCpf: ex.guia ? normalizeUser(ex.guia, { revealCpf: true }).cpf : null
  }))

  await appendLog({ entity: 'privacy', action: 'seed-export', title: 'Export sensível gerado', detail: adminDetail('gerou export sensível', [`Finalidade declarada: ${purpose}.`, `Passageiros incluídos: ${safeUsers.length}.`, `Excursões incluídas: ${excursoes.length}.`]) })

  return {
    version: 4,
    generatedAt: new Date().toISOString(),
    observacao: 'Este arquivo pode ser usado diretamente com npm run seed. Ele inclui usuários, familiares, excursões, pagamentos, grupos, despesas, lista de espera, assinaturas e logs do sistema.',
    usuarios: safeUsers,
    excursoes,
    logs
  }
})
