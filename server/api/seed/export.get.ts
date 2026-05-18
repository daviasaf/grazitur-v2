import { prisma } from '../../utils/prisma'
import { parseJson } from '../../utils/json'
import { readLogs } from '../../utils/logs'

export default defineEventHandler(async () => {
  const logs = await readLogs()
  const usuarios = await prisma.user.findMany({
    include: { parentes: true, parentesDe: true },
    orderBy: { nome: 'asc' }
  })

  const excursoesDb = await prisma.excursao.findMany({
    include: { usuarios: true, guia: true },
    orderBy: [{ finalizada: 'asc' }, { createdAt: 'desc' }]
  })

  const excursoes = excursoesDb.map((ex) => ({
    ...ex,
    valores: parseJson(ex.valores, []),
    pagamentos: parseJson(ex.pagamentosJson, {}),
    detalhes: parseJson(ex.contratoDetalhes, {}),
    grupos: parseJson(ex.contratoGrupos, {}),
    assinaturas: parseJson(ex.assinaturasJson, {}),
    despesas: parseJson(ex.despesasJson, []),
    listaEspera: parseJson(ex.listaEsperaJson, []),
    usuarioCpfs: ex.usuarios.map((u) => u.cpf),
    guiaCpf: ex.guia?.cpf || null
  }))

  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    observacao: 'Este arquivo pode ser usado diretamente com npm run seed. Ele inclui usuários, familiares, excursões, pagamentos, grupos, despesas, lista de espera, assinaturas e logs do sistema.',
    usuarios,
    excursoes,
    logs
  }
})
