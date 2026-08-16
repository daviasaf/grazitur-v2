import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  validateAdminPassword
} from '../server/utils/admin-password.ts'

test('rejects short administrative passwords', () => {
  assert.match(validateAdminPassword('Aa1!curta') || '', /12 caracteres/)
})

test('requires at least three character groups', () => {
  assert.match(validateAdminPassword('apenasletrasminusculas') || '', /três tipos/)
})

test('accepts a strong administrative password', () => {
  assert.equal(validateAdminPassword('GraziTur-2026-segura'), null)
})

test('rejects excessively long passwords', () => {
  assert.match(validateAdminPassword(`Aa1!${'x'.repeat(ADMIN_PASSWORD_MAX_LENGTH)}`) || '', /máximo/)
})
