import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from 'node:crypto'

export type CpfProtectionMode = 'disabled' | 'dual' | 'required'

export type CpfProtectedRecord = {
  cpf?: string | null
  cpfCiphertext?: string | null
  cpfBlindIndex?: string | null
  cpfKeyVersion?: number | null
  cpfLast4?: string | null
  cpfContextId?: string | null
}

const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

const securityError = (statusCode: number, statusMessage: string) => Object.assign(new Error(statusMessage), { statusCode, statusMessage })

export function normalizeCpf(value: unknown) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isValidCpf(value: unknown) {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index)
    const result = 11 - (sum % 11)
    return result >= 10 ? 0 : result
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export function maskCpf(value: unknown) {
  const cpf = normalizeCpf(value)
  return cpf.length === 11 ? `***.***.***-${cpf.slice(-2)}` : ''
}

export function cpfProtectionMode(): CpfProtectionMode {
  const configured = String(process.env.GRAZITUR_CPF_PROTECTION_MODE || '').toLowerCase()
  if (configured === 'disabled' || configured === 'dual' || configured === 'required') return configured
  return process.env.NODE_ENV === 'production' ? 'required' : 'dual'
}

function activeKeyVersion() {
  const version = Number(process.env.GRAZITUR_CPF_ACTIVE_KEY_VERSION || 1)
  if (!Number.isInteger(version) || version < 1) throw securityError(503, 'Versão ativa da chave de CPF inválida.')
  return version
}

export function cpfReadKeyVersions() {
  const active = activeKeyVersion()
  const configured = String(process.env.GRAZITUR_CPF_READ_KEY_VERSIONS || active)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)
  return [...new Set([active, ...configured])]
}

function readKey(kind: 'ENCRYPTION' | 'HMAC', version: number) {
  const name = `GRAZITUR_CPF_${kind}_KEY_V${version}`
  const encoded = String(process.env[name] || '')
  let key: Buffer
  try {
    key = Buffer.from(encoded, 'base64')
  } catch {
    key = Buffer.alloc(0)
  }
  if (key.length !== KEY_BYTES) {
    throw securityError(503, `Chave de proteção de CPF ausente ou inválida: ${name}.`)
  }
  return key
}

function aad(contextId: string, version: number) {
  return Buffer.from(`app=grazitur|entity=user|context=${contextId}|field=cpf|key_version=${version}`, 'utf8')
}

export function cpfBlindIndex(cpfValue: unknown, version = activeKeyVersion()) {
  const cpf = normalizeCpf(cpfValue)
  if (!isValidCpf(cpf)) throw securityError(400, 'CPF inválido.')
  return `v${version}:${createHmac('sha256', readKey('HMAC', version)).update(`grazitur:cpf:${cpf}`).digest('base64url')}`
}

export function cpfBlindIndexes(cpfValue: unknown) {
  return cpfReadKeyVersions().map((version) => cpfBlindIndex(cpfValue, version))
}

export function encryptCpf(cpfValue: unknown, contextId: string, version = activeKeyVersion()) {
  const cpf = normalizeCpf(cpfValue)
  if (!isValidCpf(cpf)) throw securityError(400, 'CPF inválido.')
  if (!contextId) throw securityError(500, 'Contexto criptográfico do CPF ausente.')

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', readKey('ENCRYPTION', version), iv, { authTagLength: AUTH_TAG_BYTES })
  cipher.setAAD(aad(contextId, version))
  const ciphertext = Buffer.concat([cipher.update(cpf, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `grazitur-cpf.v1.${version}.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`
}

export function decryptCpf(record: CpfProtectedRecord) {
  if (!record.cpfCiphertext) return normalizeCpf(record.cpf)
  const parts = record.cpfCiphertext.split('.')
  if (parts.length !== 6 || parts[0] !== 'grazitur-cpf' || parts[1] !== 'v1') {
    throw securityError(500, 'Envelope criptográfico de CPF inválido.')
  }
  const version = Number(parts[2])
  if (!Number.isInteger(version) || version !== Number(record.cpfKeyVersion) || !record.cpfContextId) {
    throw securityError(500, 'Metadados criptográficos de CPF inconsistentes.')
  }

  const iv = Buffer.from(parts[3]!, 'base64url')
  const ciphertext = Buffer.from(parts[4]!, 'base64url')
  const tag = Buffer.from(parts[5]!, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) throw securityError(500, 'Envelope criptográfico de CPF corrompido.')

  try {
    const decipher = createDecipheriv('aes-256-gcm', readKey('ENCRYPTION', version), iv, { authTagLength: AUTH_TAG_BYTES })
    decipher.setAAD(aad(record.cpfContextId, version))
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    if (!isValidCpf(plaintext)) throw new Error('invalid plaintext')
    return plaintext
  } catch {
    throw securityError(500, 'Não foi possível autenticar o CPF protegido.')
  }
}

export function buildCpfWriteFields(cpfValue: unknown, existingContextId?: string | null) {
  const cpf = normalizeCpf(cpfValue)
  if (!cpf) return {
    cpf: null,
    cpfCiphertext: null,
    cpfBlindIndex: null,
    cpfKeyVersion: null,
    cpfLast4: null,
    cpfContextId: existingContextId || randomUUID()
  }
  if (!isValidCpf(cpf)) throw securityError(400, 'CPF inválido.')

  const mode = cpfProtectionMode()
  const contextId = existingContextId || randomUUID()
  if (mode === 'disabled') return {
    cpf,
    cpfCiphertext: null,
    cpfBlindIndex: null,
    cpfKeyVersion: null,
    cpfLast4: cpf.slice(-4),
    cpfContextId: contextId
  }

  const version = activeKeyVersion()
  return {
    cpf: mode === 'dual' ? cpf : null,
    cpfCiphertext: encryptCpf(cpf, contextId, version),
    cpfBlindIndex: cpfBlindIndex(cpf, version),
    cpfKeyVersion: version,
    cpfLast4: cpf.slice(-4),
    cpfContextId: contextId
  }
}

export function getPlainCpf(record: CpfProtectedRecord) {
  const cpf = decryptCpf(record)
  if (!cpf && cpfProtectionMode() === 'required') {
    throw securityError(500, 'Cadastro sem CPF protegido no modo obrigatório.')
  }
  return cpf
}

export function redactSensitiveText(value: unknown) {
  return String(value ?? '')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}[- ]?\d{2}\b/g, '[CPF REDIGIDO]')
    .replace(/\b\d{11}\b/g, '[IDENTIFICADOR REDIGIDO]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[E-MAIL REDIGIDO]')
}
