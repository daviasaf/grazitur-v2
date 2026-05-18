import { prisma } from '../../../utils/prisma'
import { parseJson } from '../../../utils/json'
import { appendLog, adminDetail } from '../../../utils/logs'

type EntradaEspera = {
  id: string
  userId?: number
  nome: string
  cpf: string
  celular: string
  createdAt: string
  origem: string
}

export default defineEventHandler(async (event) => {
  const id = Number(event.context.params?.id)
  const body = await readBody<Record<string, unknown>>(event)

  if (!Number.isFinite(id)) throw createError({ statusCode: 400, statusMessage: 'ID inválido.' })

  const excursao = await prisma.excursao.findUnique({ where: { id }, include: { usuarios: true } })
  if (!excursao) throw createError({ statusCode: 404, statusMessage: 'Excursão não encontrada.' })
  if (excursao.finalizada) throw createError({ statusCode: 400, statusMessage: 'Esta excursão já foi finalizada.' })

  let user: any = null
  const userId = Number(body.userId || 0)
  const cpfBody = String(body.cpf || '').replace(/\D/g, '')

  if (userId) user = await prisma.user.findUnique({ where: { id: userId } })
  else if (cpfBody) user = await prisma.user.findUnique({ where: { cpf: cpfBody } })

  const cpf = String(user?.cpf || cpfBody || '').replace(/\D/g, '')
  const nome = String(user?.nome || body.nome || '').trim()
  const celular = String(user?.celular || body.celular || '').replace(/\D/g, '')

  if (!cpf || !nome) throw createError({ statusCode: 400, statusMessage: 'Informe um passageiro válido para a lista de espera.' })
  if (excursao.usuarios.some((u) => u.cpf === cpf)) throw createError({ statusCode: 400, statusMessage: 'Este passageiro já está vinculado a esta excursão.' })

  const lista = parseJson<EntradaEspera[]>(excursao.listaEsperaJson, [])
  const jaExiste = lista.some((item) => item.cpf === cpf || (user?.id && Number(item.userId) === Number(user.id)))
  if (jaExiste) return { success: true, alreadyExists: true, lista }

  lista.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId: user?.id,
    nome,
    cpf,
    celular,
    createdAt: new Date().toISOString(),
    origem: String(body.origem || 'Área do passageiro')
  })

  await prisma.excursao.update({ where: { id }, data: { listaEsperaJson: JSON.stringify(lista) } })
  await appendLog({ entity: 'excursao', action: 'waitlist-create', title: 'Pessoa entrou na lista de espera', detail: adminDetail('registrou interesse em uma viagem', [`Passageiro: ${nome}.`, `CPF: ${cpf}.`, celular ? `WhatsApp: ${celular}.` : 'WhatsApp: não informado.', `Excursão: ${excursao.nome}.`, `Origem: ${String(body.origem || 'Área do passageiro')}.`]) })
  return { success: true, lista }
})
