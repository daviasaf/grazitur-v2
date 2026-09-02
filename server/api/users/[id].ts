import { prisma } from '../../utils/prisma'
import { appendLog, adminDetail } from '../../utils/logs'
import { parseJson } from '../../utils/json'
import { excursionUsers, excursionUsersInclude, relatedUsers, userFamilyInclude } from '../../utils/relations'

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const method = getMethod(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })

  if (method === 'DELETE') {
    const atual = await prisma.user.findUnique({ where: { id }, include: userFamilyInclude })
    if (!atual) throw createError({ statusCode: 404, statusMessage: 'Passageiro não encontrado.' })

    const excursoes = await prisma.excursao.findMany({ include: excursionUsersInclude })
    const excursaoAfetadas: string[] = []

    for (const ex of excursoes) {
      const pagamentos = parseJson<Record<string, string>>(ex.pagamentosJson, {})
      const grupos = parseJson<Record<string, string[]>>(ex.contratoGrupos, {})
      const assinaturas = parseJson<Record<string, any>>(ex.assinaturasJson, {})
      const listaOriginal = parseJson<any[]>(ex.listaEsperaJson, [])
      let mudou = false
      if (pagamentos[String(id)]) { delete pagamentos[String(id)]; mudou = true }
      if (assinaturas[String(id)]) { delete assinaturas[String(id)]; mudou = true }
      if (assinaturas[`admin_${id}`]) { delete assinaturas[`admin_${id}`]; mudou = true }
      if (grupos[String(id)]) { delete grupos[String(id)]; mudou = true }
      for (const liderId of Object.keys(grupos)) {
        const antes = grupos[liderId] || []
        grupos[liderId] = antes.filter((depId: any) => String(depId) !== String(id))
        if (grupos[liderId].length !== antes.length) mudou = true
        if (!grupos[liderId].length) delete grupos[liderId]
      }
      const lista = listaOriginal.filter((item: any) => Number(item.userId) !== id)
      if (lista.length !== listaOriginal.length) mudou = true
      const conectado = excursionUsers(ex).some((u) => Number(u.id) === id)
      const guia = Number(ex.guiaId) === id
      if (conectado || guia || mudou) excursaoAfetadas.push(ex.nome)

      const operations: any[] = [
        prisma.excursao.update({
          where: { id: ex.id },
          data: {
            ...(guia ? { guiaId: null } : {}),
            pagamentosJson: JSON.stringify(pagamentos),
            contratoGrupos: JSON.stringify(grupos),
            assinaturasJson: JSON.stringify(assinaturas),
            listaEsperaJson: JSON.stringify(lista)
          }
        })
      ]
      if (conectado) {
        operations.push(prisma.turismoExcursionUser.deleteMany({
          where: { excursionId: ex.id, userId: id }
        }))
      }
      await prisma.$transaction(operations)
    }

    const parentesRelacionados = relatedUsers(atual)

    await prisma.user.delete({ where: { id } })
    await appendLog({ entity: 'user', action: 'delete', title: 'Passageiro excluído', detail: adminDetail('apagou um passageiro do sistema', [`Passageiro ID: ${id}.`, excursaoAfetadas.length ? `Removido das excursões/listas: ${[...new Set(excursaoAfetadas)].join(', ')}.` : 'Não havia vínculos ativos em excursões ou lista de espera.', parentesRelacionados.length ? `Vínculos familiares removidos: ${parentesRelacionados.length}.` : 'Não havia vínculos familiares.']) })
    return { success: true }
  }

  if (method === 'PUT' || method === 'PATCH') {
    throw createError({ statusCode: 403, statusMessage: 'Cadastros concluídos não podem ser editados.' })
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
