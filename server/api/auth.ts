import { getAdminSession, loginAdmin, logoutAdmin } from '../utils/admin-auth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const method = getMethod(event)

  if (method === 'GET') {
    const session = await getAdminSession(event)
    return { authenticated: Boolean(session) }
  }

  if (method === 'DELETE') {
    await logoutAdmin(event)
    return { success: true }
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const session = await loginAdmin(event, String(body.email || '').trim(), String(body.password || ''))
    return { success: true, source: session.source }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
