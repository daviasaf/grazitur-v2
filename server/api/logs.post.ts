import { appendLog } from '../utils/logs'

export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })

  const body = await readBody<Record<string, unknown>>(event)
  const title = String(body.title || '').trim()
  const entity = String(body.entity || 'sistema').trim()
  const action = String(body.action || 'manual').trim()
  const detail = String(body.detail || '').trim()

  if (!title) throw createError({ statusCode: 400, statusMessage: 'O log precisa ter um título.' })

  await appendLog({ entity, action, title, detail })
  return { success: true }
})
