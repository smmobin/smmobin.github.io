import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { createApp } from '../src/app.ts'

test('GET /health returns ok without a database', async (t) => {
  const app = createApp()
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo
  const response = await fetch(`http://127.0.0.1:${port}/health`)
  assert.equal(response.status, 200)
  const body = await response.json() as { ok: boolean; service: string }
  assert.equal(body.ok, true)
  assert.equal(body.service, 'study-planner-api')
})
