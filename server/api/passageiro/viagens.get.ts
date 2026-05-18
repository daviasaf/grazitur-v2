import { prisma } from '../../utils/prisma'
import { parseJson } from '../../utils/json'
import { normalizeUser } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const cpf = String(query.cpf || '').replace(/\D/g, '')
  if (!cpf) throw createError({ statusCode: 400, statusMessage: 'CPF obrigatório.' })

  const user = await prisma.user.findUnique({ where: { cpf }, include: { parentes: true, parentesDe: true } })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Passageiro não encontrado.' })

  const excursoes = await prisma.excursao.findMany({
    where: { finalizada: false, usuarios: { some: { id: user.id } } },
    include: { usuarios: true, guia: true, _count: { select: { usuarios: true } } },
    orderBy: { createdAt: 'desc' }
  })

  const formatadas = excursoes.map((ex) => ({
    ...ex,
    valores: parseJson(ex.valores, []),
    pagamentos: parseJson(ex.pagamentosJson, {}),
    detalhes: parseJson(ex.contratoDetalhes, {}),
    grupos: parseJson(ex.contratoGrupos, {}),
    assinaturas: parseJson(ex.assinaturasJson, {}),
    despesas: parseJson(ex.despesasJson, []),
    listaEspera: parseJson(ex.listaEsperaJson, [])
  }))

  return { user: normalizeUser(user), excursoes: formatadas }
})
