import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto'

export type LogProtectionMode = 'disabled' | 'dual' | 'required'
export type LogContentPayload = { title: string, detail: string | null }
export type LogProtectedRecord = Partial<LogContentPayload> & {
  contentCiphertext?: string | null
  contentKeyVersion?: number | null
  contentContextId?: string | null
}

const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const securityError = (statusCode: number, statusMessage: string) => Object.assign(new Error(statusMessage), { statusCode, statusMessage })

function normalizePayload(payload: Partial<LogContentPayload>): LogContentPayload {
  return {
    title: String(payload.title || 'Registro do sistema').trim() || 'Registro do sistema',
    detail: payload.detail ? String(payload.detail).trim() : null
  }
}

export function logProtectionMode(): LogProtectionMode {
  const configured = String(process.env.GRAZITUR_LOG_PROTECTION_MODE || '').toLowerCase()
  if (configured === 'disabled' || configured === 'dual' || configured === 'required') return configured
  return process.env.NODE_ENV === 'production' ? 'required' : 'dual'
}

function activeKeyVersion() {
  const version = Number(process.env.GRAZITUR_LOG_ACTIVE_KEY_VERSION || 1)
  if (!Number.isInteger(version) || version < 1) throw securityError(503, 'Versão ativa da chave de logs inválida.')
  return version
}

function readEncryptionKey(version: number) {
  const name = `GRAZITUR_LOG_ENCRYPTION_KEY_V${version}`
  const key = Buffer.from(String(process.env[name] || ''), 'base64')
  if (key.length !== KEY_BYTES) throw securityError(503, `Chave de logs ausente ou inválida: ${name}.`)
  return key
}

function aad(contextId: string, version: number) {
  return Buffer.from(`app=grazitur|entity=system_log|context=${contextId}|field=content|key_version=${version}`, 'utf8')
}

export function encryptLogContent(payload: LogContentPayload, contextId: string, version = activeKeyVersion()) {
  if (!contextId) throw securityError(500, 'Contexto criptográfico do log ausente.')
  const normalized = normalizePayload(payload)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', readEncryptionKey(version), iv, { authTagLength: AUTH_TAG_BYTES })
  cipher.setAAD(aad(contextId, version))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(normalized), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `grazitur-log.v1.${version}.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`
}

export function decryptLogContent(record: LogProtectedRecord): LogContentPayload {
  if (!record.contentCiphertext) return normalizePayload(record)
  const parts = record.contentCiphertext.split('.')
  if (parts.length !== 6 || parts[0] !== 'grazitur-log' || parts[1] !== 'v1') throw securityError(500, 'Envelope criptográfico de log inválido.')
  const version = Number(parts[2])
  if (!Number.isInteger(version) || version !== Number(record.contentKeyVersion) || !record.contentContextId) throw securityError(500, 'Metadados criptográficos do log inconsistentes.')
  const iv = Buffer.from(parts[3]!, 'base64url')
  const ciphertext = Buffer.from(parts[4]!, 'base64url')
  const tag = Buffer.from(parts[5]!, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) throw securityError(500, 'Envelope criptográfico de log corrompido.')
  try {
    const decipher = createDecipheriv('aes-256-gcm', readEncryptionKey(version), iv, { authTagLength: AUTH_TAG_BYTES })
    decipher.setAAD(aad(record.contentContextId, version))
    decipher.setAuthTag(tag)
    return normalizePayload(JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as LogContentPayload)
  } catch {
    throw securityError(500, 'Não foi possível autenticar o conteúdo protegido do log.')
  }
}

export function buildLogWriteFields(payload: LogContentPayload, existingContextId?: string | null) {
  const normalized = normalizePayload(payload)
  const mode = logProtectionMode()
  const contextId = existingContextId || randomUUID()
  if (mode === 'disabled') return { ...normalized, contentCiphertext: null, contentKeyVersion: null, contentContextId: contextId }
  const version = activeKeyVersion()
  const protectedFields = {
    contentCiphertext: encryptLogContent(normalized, contextId, version),
    contentKeyVersion: version,
    contentContextId: contextId
  }
  if (mode === 'dual') return { ...normalized, ...protectedFields }
  return { title: 'Registro protegido', detail: null, ...protectedFields }
}

export function getPlainLogContent(record: LogProtectedRecord) {
  const payload = decryptLogContent(record)
  if (!record.contentCiphertext && logProtectionMode() === 'required') throw securityError(500, 'Log sem conteúdo protegido no modo obrigatório.')
  return payload
}
