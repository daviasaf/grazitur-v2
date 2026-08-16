import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import {
  buildCpfWriteFields,
  cpfBlindIndex,
  decryptCpf,
  encryptCpf,
  isValidCpf,
  maskCpf,
  normalizeCpf,
  redactSensitiveText
} from '../server/utils/cpf-security.ts'

const TEST_CPF = '52998224725'
process.env.GRAZITUR_CPF_ACTIVE_KEY_VERSION = '1'
process.env.GRAZITUR_CPF_ENCRYPTION_KEY_V1 = randomBytes(32).toString('base64')
process.env.GRAZITUR_CPF_HMAC_KEY_V1 = randomBytes(32).toString('base64')
process.env.GRAZITUR_CPF_PROTECTION_MODE = 'dual'

test('normaliza, valida e mascara CPF sintético', () => {
  assert.equal(normalizeCpf('529.982.247-25'), TEST_CPF)
  assert.equal(isValidCpf(TEST_CPF), true)
  assert.equal(isValidCpf('11111111111'), false)
  assert.equal(isValidCpf('52998224724'), false)
  assert.equal(maskCpf(TEST_CPF), '***.***.***-25')
})

test('HMAC é determinístico e não contém o CPF', () => {
  const first = cpfBlindIndex(TEST_CPF)
  const second = cpfBlindIndex('529.982.247-25')
  assert.equal(first, second)
  assert.equal(first.includes(TEST_CPF), false)
})

test('AES-256-GCM usa nonce aleatório e autentica AAD', () => {
  const contextId = randomUUID()
  const first = encryptCpf(TEST_CPF, contextId)
  const second = encryptCpf(TEST_CPF, contextId)
  assert.notEqual(first, second)
  assert.equal(decryptCpf({ cpfCiphertext: first, cpfKeyVersion: 1, cpfContextId: contextId }), TEST_CPF)
  assert.throws(() => decryptCpf({ cpfCiphertext: first, cpfKeyVersion: 1, cpfContextId: randomUUID() }))
})

test('ciphertext adulterado é rejeitado', () => {
  const contextId = randomUUID()
  const encrypted = encryptCpf(TEST_CPF, contextId)
  const parts = encrypted.split('.')
  parts[4] = `${parts[4].slice(0, -1)}${parts[4].endsWith('A') ? 'B' : 'A'}`
  assert.throws(() => decryptCpf({ cpfCiphertext: parts.join('.'), cpfKeyVersion: 1, cpfContextId: contextId }))
})

test('dual-write gera todos os campos protegidos', () => {
  const fields = buildCpfWriteFields(TEST_CPF)
  assert.equal(fields.cpf, TEST_CPF)
  assert.equal(fields.cpfLast4, '4725')
  assert.equal(fields.cpfKeyVersion, 1)
  assert.ok(fields.cpfCiphertext)
  assert.ok(fields.cpfBlindIndex)
  assert.ok(fields.cpfContextId)
})

test('redação remove CPF e e-mail de logs', () => {
  const value = redactSensitiveText(`CPF: ${TEST_CPF}; contato: teste@example.com`)
  assert.equal(value.includes(TEST_CPF), false)
  assert.equal(value.includes('teste@example.com'), false)
})
