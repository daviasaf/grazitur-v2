import {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  requestAdminPasswordRecovery,
  updateAdminPasswordWithRecoveryToken
} from '../utils/admin-auth'
import { validateAdminPassword } from '../utils/admin-password'

function passwordRecoveryRedirect() {
  const configuredUrl = String(process.env.GRAZITUR_PUBLIC_URL || '').trim()
  if (!configuredUrl) {
    throw createError({ statusCode: 503, statusMessage: 'URL pública do GraziTur não configurada.' })
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(configuredUrl)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'URL pública do GraziTur inválida.' })
  }

  if (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:') {
    throw createError({ statusCode: 503, statusMessage: 'A recuperação de senha exige HTTPS em produção.' })
  }

  return new URL('/admin/redefinir-senha', baseUrl).toString()
}

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

    if (action === 'request-password-recovery') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw createError({ statusCode: 400, statusMessage: 'Digite um e-mail válido.' })
      }
      await requestAdminPasswordRecovery(email, passwordRecoveryRedirect())
      return {
        success: true,
        message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.'
      }
    }

    if (action === 'complete-password-recovery') {
      const accessToken = String(body.accessToken || '')
      const password = String(body.password || '')
      if (accessToken.length < 100 || accessToken.length > 8192) {
        throw createError({ statusCode: 400, statusMessage: 'Link de recuperação inválido ou expirado.' })
      }
      const passwordError = validateAdminPassword(password)
      if (passwordError) throw createError({ statusCode: 400, statusMessage: passwordError })
      await updateAdminPasswordWithRecoveryToken(accessToken, password)
      return { success: true }
    }

    if (action !== 'login') {
      throw createError({ statusCode: 400, statusMessage: 'Ação de autenticação inválida.' })
    }

    const session = await loginAdmin(event, String(body.email || '').trim(), String(body.password || ''))
    return { success: true, source: session.source }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método não permitido.' })
})
