import type { H3Event } from 'h3'
import { deleteCookie, getCookie, setCookie } from 'h3'
import { requireSessionSecret, signSession, verifySession } from './signed-session'

const COOKIE_NAME = 'grazitur_passenger_session'
const SESSION_SECONDS = 30 * 60

export function setPassengerSession(event: H3Event, userId: number) {
  const now = Math.floor(Date.now() / 1000)
  const secret = requireSessionSecret('PASSENGER_SESSION_SECRET')
  const token = signSession({ sub: userId, exp: now + SESSION_SECONDS }, secret, 'passenger')
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS
  })
}

export function clearPassengerSession(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

export function getPassengerUserId(event: H3Event) {
  const secret = requireSessionSecret('PASSENGER_SESSION_SECRET')
  const payload = verifySession<{ sub: number; exp: number }>(getCookie(event, COOKIE_NAME), secret, 'passenger')
  const userId = Number(payload?.sub)
  return Number.isFinite(userId) && userId > 0 ? userId : null
}

export function requirePassengerSession(event: H3Event, expectedUserId?: number) {
  const userId = getPassengerUserId(event)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Sessão do passageiro ausente ou expirada.' })
  if (expectedUserId && userId !== expectedUserId) throw createError({ statusCode: 403, statusMessage: 'Acesso negado a outro passageiro.' })
  return userId
}
