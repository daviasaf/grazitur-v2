import assert from 'node:assert/strict'
import test from 'node:test'
import {
  attachExcursionUsers,
  attachUserFamily,
  relatedUsers
} from '../server/utils/relations.ts'

test('normaliza parentescos explícitos sem duplicar usuários', () => {
  const user = {
    id: 1,
    kinshipsFrom: [
      { relativeUser: { id: 2, nome: 'Parente A' } },
      { relativeUser: { id: 1, nome: 'Próprio usuário' } }
    ],
    kinshipsTo: [
      { user: { id: 3, nome: 'Parente B' } },
      { user: { id: 2, nome: 'Parente A atualizado' } }
    ]
  }

  assert.deepEqual(relatedUsers(user).map(relative => relative.id), [2, 3])

  const normalized = attachUserFamily(user)
  assert.equal('kinshipsFrom' in normalized, false)
  assert.equal('kinshipsTo' in normalized, false)
  assert.deepEqual(normalized.parentes.map(relative => relative.id), [2, 3])
  assert.deepEqual(normalized.parentesDe.map(relative => relative.id), [3, 2])
})

test('normaliza participantes e mantém o contrato da contagem da API', () => {
  const normalized = attachExcursionUsers({
    id: 10,
    userLinks: [
      { user: { id: 1 } },
      { user: { id: 2 } }
    ],
    _count: { userLinks: 2 }
  })

  assert.equal('userLinks' in normalized, false)
  assert.deepEqual(normalized.usuarios.map(user => user.id), [1, 2])
  assert.deepEqual(normalized._count, { usuarios: 2 })
})
