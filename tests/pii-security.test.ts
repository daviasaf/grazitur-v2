import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import {
  buildPersonalDataWriteFields,
  decryptPersonalData,
  encryptPersonalData,
  type PersonalDataPayload
} from '../server/utils/pii-security.ts'

const TEST_PROFILE: PersonalDataPayload = {
  nome: 'Pessoa Sintética de Teste',
  email: 'pessoa.sintetica@example.com',
  rg: 'RG-SINTETICO-01',
  orgaoExpeditor: 'TESTE',
  nascimento: '01/01/2000',
  celular: '(00) 90000-0000',
  cidade: 'Cidade de Teste, TS',
  endereco: 'Endereço sintético, 100',
  idade: 26
}

process.env.GRAZITUR_PII_ACTIVE_KEY_VERSION = '1'
process.env.GRAZITUR_PII_ENCRYPTION_KEY_V1 = randomBytes(32).toString('base64')
process.env.GRAZITUR_PII_PROTECTION_MODE = 'dual'

test('encrypts and decrypts the complete personal profile', () => {
  const contextId = randomUUID()
  const encrypted = encryptPersonalData(TEST_PROFILE, contextId)
  assert.equal(encrypted.includes(TEST_PROFILE.nome), false)
  assert.deepEqual(decryptPersonalData({ piiCiphertext: encrypted, piiKeyVersion: 1, piiContextId: contextId }), TEST_PROFILE)
})

test('uses a random nonce and binds ciphertext to the record context', () => {
  const contextId = randomUUID()
  const first = encryptPersonalData(TEST_PROFILE, contextId)
  const second = encryptPersonalData(TEST_PROFILE, contextId)
  assert.notEqual(first, second)
  assert.throws(() => decryptPersonalData({ piiCiphertext: first, piiKeyVersion: 1, piiContextId: randomUUID() }))
})

test('rejects tampered personal-data ciphertext', () => {
  const contextId = randomUUID()
  const encrypted = encryptPersonalData(TEST_PROFILE, contextId)
  const parts = encrypted.split('.')
  const tag = Buffer.from(parts[5]!, 'base64url')
  tag[0] = tag[0]! ^ 1
  parts[5] = tag.toString('base64url')
  assert.throws(() => decryptPersonalData({ piiCiphertext: parts.join('.'), piiKeyVersion: 1, piiContextId: contextId }))
})

test('dual-write includes plaintext only during the migration window', () => {
  const fields = buildPersonalDataWriteFields(TEST_PROFILE)
  assert.equal(fields.nome, TEST_PROFILE.nome)
  assert.ok(fields.piiCiphertext)
  assert.equal(fields.piiKeyVersion, 1)
  assert.ok(fields.piiContextId)
})

test('required mode removes legacy plaintext and keeps the profile recoverable', () => {
  process.env.GRAZITUR_PII_PROTECTION_MODE = 'required'
  try {
    const fields = buildPersonalDataWriteFields(TEST_PROFILE)
    assert.equal(fields.nome, 'Dado protegido')
    assert.equal(fields.email, null)
    assert.equal(fields.rg, null)
    assert.equal(fields.endereco, null)
    assert.deepEqual(decryptPersonalData(fields), TEST_PROFILE)
  } finally {
    process.env.GRAZITUR_PII_PROTECTION_MODE = 'dual'
  }
})
