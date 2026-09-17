import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  validateAdminPassword
} from '../server/utils/admin-password.ts'
import { buildAdminPasswordRecoveryRequest } from '../server/utils/admin-password-recovery.ts'
import { assertIsolatedAdminAuthProject } from '../server/utils/admin-auth-project.ts'

const sharedDatabaseUrl = 'postgresql://postgres.xgrcwdtkalelegoysxbw:example@aws-1-sa-east-1.pooler.supabase.com:6543/postgres'

test('refuses a shared Supabase Auth project even when the administrator email matches', () => {
  assert.throws(
    () => assertIsolatedAdminAuthProject('https://xgrcwdtkalelegoysxbw.supabase.co', sharedDatabaseUrl, ''),
    /projeto Supabase próprio/
  )
})

test('accepts an isolated Auth project while keeping the existing database', () => {
  assert.doesNotThrow(
    () => assertIsolatedAdminAuthProject('https://isolatedauthproject.supabase.co', sharedDatabaseUrl, '')
  )
})

test('fails closed when the database project cannot be identified', () => {
  assert.throws(
    () => assertIsolatedAdminAuthProject('https://isolatedauthproject.supabase.co', '', ''),
    /projeto Supabase próprio/
  )
})

test('recognizes direct Supabase database URLs as shared too', () => {
  assert.throws(
    () => assertIsolatedAdminAuthProject(
      'https://xgrcwdtkalelegoysxbw.supabase.co',
      'postgresql://postgres:example@db.xgrcwdtkalelegoysxbw.supabase.co:5432/postgres',
      ''
    ),
    /projeto Supabase próprio/
  )
})

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

test('sends the recovery redirect in the Supabase query string', () => {
  const request = buildAdminPasswordRecoveryRequest(
    'admin@example.com',
    'https://grazitur.vercel.app/admin/redefinir-senha'
  )
  const requestUrl = new URL(`https://example.supabase.co/auth/v1${request.path}`)
  assert.equal(requestUrl.pathname, '/auth/v1/recover')
  assert.equal(
    requestUrl.searchParams.get('redirect_to'),
    'https://grazitur.vercel.app/admin/redefinir-senha'
  )
  assert.deepEqual(JSON.parse(request.body), { email: 'admin@example.com' })
})
