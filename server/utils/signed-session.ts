import { createHmac, timingSafeEqual } from 'node:crypto'

type SessionPayload = {
  exp: number
  [key: string]: unknown
}

const encode = (value: string | Buffer) => Buffer.from(value).toString('base64url')

export function requireSessionSecret(name: string) {
  const value = String(process.env[name] || '')
  if (Buffer.byteLength(value, 'utf8') < 32) {
    throw createError({ statusCode: 503, statusMessage: `Configuração segura ausente: ${name}.` })
  }
  return value
}

export function signSession(payload: SessionPayload, secret: string, context: string) {
  const body = encode(JSON.stringify(payload))
  const signature = createHmac('sha256', secret).update(`${context}.${body}`).digest('base64url')
  return `${body}.${signature}`
}

export function verifySession<T extends SessionPayload>(token: string | undefined, secret: string, context: string): T | null {
  if (!token) return null
  const [body, signature, extra] = token.split('.')
  if (!body || !signature || extra) return null

  const expected = createHmac('sha256', secret).update(`${context}.${body}`).digest()
  let provided: Buffer
  try {
    provided = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function constantTimeTextEqual(left: string, right: string) {
  const leftHash = createHmac('sha256', 'grazitur-credential-compare').update(left).digest()
  const rightHash = createHmac('sha256', 'grazitur-credential-compare').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}
