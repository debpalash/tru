import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const auditor = resolve('scripts/audit-release.py')

test('release audit rejects embedded public bearer tokens without revealing their values', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tru-audit-'))
  try {
    const token = 'A'.repeat(20) + 'q'.repeat(80)
    const artifact = join(folder, 'bundle.js')
    writeFileSync(artifact, `const authorization = "Bearer ${token}"`)
    const result = Bun.spawnSync(['python3', auditor, artifact])
    expect(result.exitCode).toBe(1)
    expect(result.stdout.toString()).toContain('Release audit failed')
    expect(result.stdout.toString()).not.toContain(token)
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('release audit rejects private files inside archives and accepts empty env examples', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tru-audit-'))
  try {
    for (const [name, expected] of [['.env.example', 0], ['.env.production', 1], ['.local/account.token', 1], ['release.jks', 1]] as const) {
      const artifact = join(folder, 'source.zip')
      const packed = Bun.spawnSync(['python3', '-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr(sys.argv[2],"API_KEY=\\n"); z.close()', artifact, name])
      expect(packed.exitCode).toBe(0)
      expect(Bun.spawnSync(['python3', auditor, artifact]).exitCode).toBe(expected)
    }
  } finally { rmSync(folder, { recursive: true, force: true }) }
})

test('release audit rejects private builder paths in native binaries', () => {
  const folder = mkdtempSync(join(tmpdir(), 'tru-audit-'))
  try {
    const artifact = join(folder, 'libapp.so')
    writeFileSync(artifact, '/Users/' + 'private-builder' + '/Desktop/project/source.cpp')
    const result = Bun.spawnSync(['python3', auditor, artifact])
    expect(result.exitCode).toBe(1)
    expect(result.stdout.toString()).toContain('private build path')
    expect(result.stdout.toString()).not.toContain('private-builder')
  } finally { rmSync(folder, { recursive: true, force: true }) }
})
