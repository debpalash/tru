import { test, expect } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'

test('issuing access twice never creates an undeliverable extra token', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tru-access-test-'))
  const env = { ...process.env, TRU_DATA_DIR: dir }
  try {
    const issued = Bun.spawnSync([process.execPath, 'server/access.ts', 'issue', 'fixture'], { cwd: process.cwd(), env })
    expect(issued.exitCode).toBe(0)
    const token = readFileSync(join(dir, 'fixture.token'), 'utf8')
    const duplicate = Bun.spawnSync([process.execPath, 'server/access.ts', 'issue', 'fixture'], { cwd: process.cwd(), env })
    expect(duplicate.exitCode).not.toBe(0)
    expect(readFileSync(join(dir, 'fixture.token'), 'utf8')).toBe(token)
    const db = new Database(join(dir, 'access.sqlite'))
    expect(db.query('SELECT COUNT(*) AS count FROM tokens').get()).toEqual({ count: 1 })
    db.close()
    expect(Bun.spawnSync([process.execPath, 'server/access.ts', 'revoke', 'fixture'], { cwd: process.cwd(), env }).exitCode).toBe(0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
