import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import { buildLogWriteFields, decryptLogContent, encryptLogContent } from '../server/utils/log-security.ts'

const CONTENT = { title: 'Operação sintética', detail: 'Conteúdo de auditoria para teste.' }
process.env.GRAZITUR_LOG_ACTIVE_KEY_VERSION = '1'
process.env.GRAZITUR_LOG_ENCRYPTION_KEY_V1 = randomBytes(32).toString('base64')
process.env.GRAZITUR_LOG_PROTECTION_MODE = 'dual'

test('encrypts and authenticates complete log content', () => {
  const contextId = randomUUID()
  const encrypted = encryptLogContent(CONTENT, contextId)
  assert.equal(encrypted.includes(CONTENT.detail), false)
  assert.deepEqual(decryptLogContent({ contentCiphertext: encrypted, contentKeyVersion: 1, contentContextId: contextId }), CONTENT)
  assert.throws(() => decryptLogContent({ contentCiphertext: encrypted, contentKeyVersion: 1, contentContextId: randomUUID() }))
})

test('required mode keeps log recoverable without plaintext', () => {
  process.env.GRAZITUR_LOG_PROTECTION_MODE = 'required'
  try {
    const fields = buildLogWriteFields(CONTENT)
    assert.equal(fields.title, 'Registro protegido')
    assert.equal(fields.detail, null)
    assert.deepEqual(decryptLogContent(fields), CONTENT)
  } finally {
    process.env.GRAZITUR_LOG_PROTECTION_MODE = 'dual'
  }
})
