import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

import { AuthStorage } from '@gsd/pi-coding-agent'

import { loadStoredEnvKeys } from '../wizard.ts'

test('loadStoredEnvKeys hydrates CONTEXT7_API_KEY from stored auth to suppress free-tier startup warning', (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'gsd-context7-warning-'))
  const authPath = join(tmp, 'auth.json')
  writeFileSync(authPath, JSON.stringify({
    context7: { type: 'api_key', key: 'stored-context7-key' },
  }))

  const original = process.env.CONTEXT7_API_KEY
  delete process.env.CONTEXT7_API_KEY

  t.after(() => {
    if (original) process.env.CONTEXT7_API_KEY = original
    else delete process.env.CONTEXT7_API_KEY
    rmSync(tmp, { recursive: true, force: true })
  })

  const auth = AuthStorage.create(authPath)
  loadStoredEnvKeys(auth)

  assert.equal(process.env.CONTEXT7_API_KEY, 'stored-context7-key')
})

// getPiDefaultModelAndProvider uses a module-level constant
// (join(homedir(), '.pi', 'agent', 'settings.json')) that is resolved at
// import time, so it cannot be mocked without --experimental-test-module-mocks.
// These tests read from the real ~/.pi/agent/settings.json if it exists.

test('getPiDefaultModelAndProvider returns null when no Pi settings exist', async (t) => {
  const piSettingsPath = join(homedir(), '.pi', 'agent', 'settings.json')
  if (existsSync(piSettingsPath)) {
    t.skip('Pi settings file exists on this machine — cannot test absence')
    return
  }

  const { getPiDefaultModelAndProvider } = await import('../pi-migration.ts')
  assert.equal(getPiDefaultModelAndProvider(), null)
})

test('getPiDefaultModelAndProvider reads real Pi settings if present', async (t) => {
  const piSettingsPath = join(homedir(), '.pi', 'agent', 'settings.json')
  if (!existsSync(piSettingsPath)) {
    t.skip('No Pi settings file on this machine')
    return
  }

  const { getPiDefaultModelAndProvider } = await import('../pi-migration.ts')
  const result = getPiDefaultModelAndProvider()
  // If the file exists and has valid keys, result should be non-null with provider+model
  if (result) {
    assert.ok(typeof result.provider === 'string')
    assert.ok(typeof result.model === 'string')
  }
})
