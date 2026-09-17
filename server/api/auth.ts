import {
  getAdminSession,
  loginAdmin,
  logoutAdmin
} from '../utils/admin-auth'

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
    const action = String(body.action || 'login')

    if (action === 'request-password-recovery' || action === 'complete-password-recovery') {
      throw createError({ statusCode: 503, statusMessage: 'Recuperação de senha indisponível no GraziTur.' })
    }

    if (action !== 'login') {
      throw createError({ statusCode: 400, statusMessage: 'Ação de autenticação inválida.' })
    }

    const session = await loginAdmin(event, String(body.email || '').trim(), String(body.password || ''))
    return { success: true, source: session.source }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
