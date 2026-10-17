import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, isValidEmail, normalizeEmail, verifyPassword } from '../src/auth/password.ts'

test('normalizes and validates email', () => {
  assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com')
  assert.equal(isValidEmail('ada@example.com'), true)
  assert.equal(isValidEmail('not-an-email'), false)
})

test('hashes a password and verifies the same value', async () => {
  const stored = await hashPassword('correct-horse')
  assert.equal(await verifyPassword('correct-horse', stored), true)
  assert.equal(await verifyPassword('wrong-password', stored), false)
  assert.equal(stored.startsWith('scrypt$'), true)
})
