import type { H3Event } from 'h3'
import { deleteCookie, getCookie, setCookie } from 'h3'
import { constantTimeTextEqual, requireSessionSecret, signSession, verifySession } from './signed-session'

const ACCESS_COOKIE = 'grazitur_admin_access'
const REFRESH_COOKIE = 'grazitur_admin_refresh'
const LEGACY_COOKIE = 'grazitur_admin_session'
const COOKIE_PATH = '/'

type SupabaseUser = {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  user: SupabaseUser
}

type AuthRequestResult<T> = {
  ok: boolean
  status: number
  data: T | null
}

type AdminSession = {
  id: string
  email?: string
  source: 'supabase' | 'legacy-development'
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: COOKIE_PATH,
  maxAge
})

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || '')
  return url && key ? { url, key } : null
}

function isAdmin(user: SupabaseUser | null | undefined) {
  const role = user?.app_metadata?.role
  const roles = user?.app_metadata?.roles
  return role === 'admin' || (Array.isArray(roles) && roles.includes('admin'))
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<AuthRequestResult<T>> {
  const config = supabaseConfig()
  if (!config) throw createError({ statusCode: 503, statusMessage: 'Supabase Auth não configurado.' })
  const response = await fetch(`${config.url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })
  const data = await response.json().catch(() => null) as T | null
  return { ok: response.ok, status: response.status, data }
}

async function authFetch<T>(path: string, init: RequestInit = {}) {
  const result = await authRequest<T>(path, init)
  return result.ok ? result.data : null
}

function setSupabaseCookies(event: H3Event, tokens: TokenResponse) {
  setCookie(event, ACCESS_COOKIE, tokens.access_token, cookieOptions(Math.max(60, Number(tokens.expires_in || 3600))))
  setCookie(event, REFRESH_COOKIE, tokens.refresh_token, cookieOptions(60 * 60 * 24 * 30))
  deleteCookie(event, LEGACY_COOKIE, { path: COOKIE_PATH })
}

function clearAdminCookies(event: H3Event) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, LEGACY_COOKIE]) deleteCookie(event, name, { path: COOKIE_PATH })
}

async function getSupabaseUser(accessToken: string) {
  return await authFetch<SupabaseUser>('/user', { headers: { Authorization: `Bearer ${accessToken}` } })
}

async function refreshSupabaseSession(event: H3Event) {
  const refreshToken = getCookie(event, REFRESH_COOKIE)
  if (!refreshToken) return null
  const tokens = await authFetch<TokenResponse>('/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken })
  })
  if (!tokens || !isAdmin(tokens.user)) return null
  setSupabaseCookies(event, tokens)
  return tokens.user
}

export async function loginAdmin(event: H3Event, email: string, password: string): Promise<AdminSession> {
  if (supabaseConfig()) {
    const tokens = await authFetch<TokenResponse>('/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    if (!tokens || !isAdmin(tokens.user)) {
      throw createError({ statusCode: 401, statusMessage: 'Credenciais inválidas ou usuário sem papel administrativo.' })
    }
    setSupabaseCookies(event, tokens)
    return { id: tokens.user.id, email: tokens.user.email, source: 'supabase' }
  }

  const allowLegacy = process.env.NODE_ENV !== 'production' && process.env.GRAZITUR_ALLOW_LEGACY_ADMIN_AUTH === 'true'
  if (!allowLegacy) {
    throw createError({ statusCode: 503, statusMessage: 'Configure o Supabase Auth antes de habilitar o painel administrativo.' })
  }
  const expectedEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase()
  const expectedPassword = String(process.env.ADMIN_PASSWORD || '')
  if (!expectedEmail || !expectedPassword || !constantTimeTextEqual(email.toLowerCase(), expectedEmail) || !constantTimeTextEqual(password, expectedPassword)) {
    throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha incorretos.' })
  }
  const now = Math.floor(Date.now() / 1000)
  const secret = requireSessionSecret('ADMIN_SESSION_SECRET')
  setCookie(event, LEGACY_COOKIE, signSession({ sub: 'admin', exp: now + 3600 }, secret, 'admin'), cookieOptions(3600))
  return { id: 'legacy-development-admin', email: expectedEmail, source: 'legacy-development' }
}

export async function requestAdminPasswordRecovery(email: string, redirectTo: string) {
  const result = await authRequest('/recover', {
    method: 'POST',
    body: JSON.stringify({ email, redirect_to: redirectTo })
  })

  // Auth deliberately returns a generic response for unknown users. Preserve that
  // behavior so this public endpoint cannot be used to enumerate administrators.
  if (!result.ok && result.status >= 500) {
    throw createError({ statusCode: 503, statusMessage: 'Não foi possível solicitar a recuperação agora.' })
  }
}

export async function updateAdminPasswordWithRecoveryToken(accessToken: string, password: string) {
  const authorization = { Authorization: `Bearer ${accessToken}` }
  const userResult = await authRequest<SupabaseUser>('/user', { headers: authorization })
  if (!userResult.ok || !isAdmin(userResult.data)) {
    throw createError({ statusCode: 401, statusMessage: 'Link de recuperação inválido ou expirado.' })
  }

  const updateResult = await authRequest('/user', {
    method: 'PUT',
    headers: authorization,
    body: JSON.stringify({ password })
  })
  if (!updateResult.ok) {
    const statusCode = updateResult.status >= 500 ? 503 : 400
    throw createError({
      statusCode,
      statusMessage: statusCode === 503
        ? 'Não foi possível atualizar a senha agora.'
        : 'A senha não foi aceita. Revise os requisitos e tente novamente.'
    })
  }

  // The recovery session has served its purpose. Revoking every existing session
  // prevents an older token from surviving a password reset.
  await authRequest('/logout?scope=global', {
    method: 'POST',
    headers: authorization
  }).catch(() => null)
}

export async function getAdminSession(event: H3Event): Promise<AdminSession | null> {
  const config = supabaseConfig()
  if (config) {
    const accessToken = getCookie(event, ACCESS_COOKIE)
    let user = accessToken ? await getSupabaseUser(accessToken) : null
    if (!user) user = await refreshSupabaseSession(event)
    if (!user || !isAdmin(user)) return null
    return { id: user.id, email: user.email, source: 'supabase' }
  }

  if (process.env.NODE_ENV === 'production' || process.env.GRAZITUR_ALLOW_LEGACY_ADMIN_AUTH !== 'true') return null
  const secret = requireSessionSecret('ADMIN_SESSION_SECRET')
  const payload = verifySession<{ sub: string; exp: number }>(getCookie(event, LEGACY_COOKIE), secret, 'admin')
  return payload?.sub === 'admin' ? { id: 'legacy-development-admin', source: 'legacy-development' } : null
}

export async function requireAdminSession(event: H3Event) {
  const session = await getAdminSession(event)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Sessão administrativa ausente ou expirada.' })
  return session
}

export async function logoutAdmin(event: H3Event) {
  const config = supabaseConfig()
  const accessToken = getCookie(event, ACCESS_COOKIE)
  if (config && accessToken) {
    await authFetch('/logout', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null)
  }
  clearAdminCookies(event)
}
