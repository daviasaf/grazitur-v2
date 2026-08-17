import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto'

export type PiiProtectionMode = 'disabled' | 'dual' | 'required'

export type PersonalDataPayload = {
  nome: string
  email: string | null
  rg: string | null
  orgaoExpeditor: string | null
  nascimento: string | null
  celular: string | null
  cidade: string | null
  endereco: string | null
  idade: number | null
}

export type PiiProtectedRecord = Partial<PersonalDataPayload> & {
  piiCiphertext?: string | null
  piiKeyVersion?: number | null
  piiContextId?: string | null
}

const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

const securityError = (statusCode: number, statusMessage: string) => Object.assign(new Error(statusMessage), { statusCode, statusMessage })

export function piiProtectionMode(): PiiProtectionMode {
  const configured = String(process.env.GRAZITUR_PII_PROTECTION_MODE || '').toLowerCase()
  if (configured === 'disabled' || configured === 'dual' || configured === 'required') return configured
  return process.env.NODE_ENV === 'production' ? 'required' : 'dual'
}

function activeKeyVersion() {
  const version = Number(process.env.GRAZITUR_PII_ACTIVE_KEY_VERSION || 1)
  if (!Number.isInteger(version) || version < 1) throw securityError(503, 'Versão ativa da chave de dados pessoais inválida.')
  return version
}

function readEncryptionKey(version: number) {
  const name = `GRAZITUR_PII_ENCRYPTION_KEY_V${version}`
  const key = Buffer.from(String(process.env[name] || ''), 'base64')
  if (key.length !== KEY_BYTES) throw securityError(503, `Chave de dados pessoais ausente ou inválida: ${name}.`)
  return key
}

function aad(contextId: string, version: number) {
  return Buffer.from(`app=grazitur|entity=user|context=${contextId}|field=personal_profile|key_version=${version}`, 'utf8')
}

function normalizePayload(payload: Partial<PersonalDataPayload>): PersonalDataPayload {
  const rawAge = payload.idade
  const idade = rawAge === null || rawAge === undefined || String(rawAge).trim() === ''
    ? null
    : Number(rawAge)
  return {
    nome: String(payload.nome || '').trim(),
    email: payload.email ? String(payload.email).trim() : null,
    rg: payload.rg ? String(payload.rg).trim() : null,
    orgaoExpeditor: payload.orgaoExpeditor ? String(payload.orgaoExpeditor).trim() : null,
    nascimento: payload.nascimento ? String(payload.nascimento).trim() : null,
    celular: payload.celular ? String(payload.celular).trim() : null,
    cidade: payload.cidade ? String(payload.cidade).trim() : null,
    endereco: payload.endereco ? String(payload.endereco).trim() : null,
    idade: idade !== null && Number.isFinite(idade) ? idade : null
  }
}

export function encryptPersonalData(payload: PersonalDataPayload, contextId: string, version = activeKeyVersion()) {
  if (!contextId) throw securityError(500, 'Contexto criptográfico dos dados pessoais ausente.')
  const normalized = normalizePayload(payload)
  if (normalized.nome.length < 2) throw securityError(400, 'Nome inválido para proteção.')

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', readEncryptionKey(version), iv, { authTagLength: AUTH_TAG_BYTES })
  cipher.setAAD(aad(contextId, version))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(normalized), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `grazitur-pii.v1.${version}.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`
}

export function decryptPersonalData(record: PiiProtectedRecord): PersonalDataPayload {
  if (!record.piiCiphertext) return normalizePayload(record)
  const parts = record.piiCiphertext.split('.')
  if (parts.length !== 6 || parts[0] !== 'grazitur-pii' || parts[1] !== 'v1') {
    throw securityError(500, 'Envelope criptográfico de dados pessoais inválido.')
  }
  const version = Number(parts[2])
  if (!Number.isInteger(version) || version !== Number(record.piiKeyVersion) || !record.piiContextId) {
    throw securityError(500, 'Metadados criptográficos de dados pessoais inconsistentes.')
  }

  const iv = Buffer.from(parts[3]!, 'base64url')
  const ciphertext = Buffer.from(parts[4]!, 'base64url')
  const tag = Buffer.from(parts[5]!, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) throw securityError(500, 'Envelope criptográfico de dados pessoais corrompido.')

  try {
    const decipher = createDecipheriv('aes-256-gcm', readEncryptionKey(version), iv, { authTagLength: AUTH_TAG_BYTES })
    decipher.setAAD(aad(record.piiContextId, version))
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    const parsed = normalizePayload(JSON.parse(plaintext) as PersonalDataPayload)
    if (parsed.nome.length < 2) throw new Error('invalid payload')
    return parsed
  } catch {
    throw securityError(500, 'Não foi possível autenticar os dados pessoais protegidos.')
  }
}

export function buildPersonalDataWriteFields(payload: PersonalDataPayload, existingContextId?: string | null) {
  const normalized = normalizePayload(payload)
  const mode = piiProtectionMode()
  const contextId = existingContextId || randomUUID()
  if (mode === 'disabled') return {
    ...normalized,
    piiCiphertext: null,
    piiKeyVersion: null,
    piiContextId: contextId
  }

  const version = activeKeyVersion()
  const protectedFields = {
    piiCiphertext: encryptPersonalData(normalized, contextId, version),
    piiKeyVersion: version,
    piiContextId: contextId
  }
  if (mode === 'dual') return { ...normalized, ...protectedFields }
  return {
    nome: 'Dado protegido',
    email: null,
    rg: null,
    orgaoExpeditor: null,
    nascimento: null,
    celular: null,
    cidade: null,
    endereco: null,
    idade: null,
    ...protectedFields
  }
}

export function getPlainPersonalData(record: PiiProtectedRecord) {
  const payload = decryptPersonalData(record)
  if (!record.piiCiphertext && piiProtectionMode() === 'required') {
    throw securityError(500, 'Cadastro sem perfil pessoal protegido no modo obrigatório.')
  }
  return payload
}
