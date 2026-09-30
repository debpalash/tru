import { mkdirSync, openSync, writeFileSync, closeSync, unlinkSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { AccessStore } from './security'
process.umask(0o077)
const dataDir = resolve(process.env.TRU_DATA_DIR || '.local')
mkdirSync(dataDir, { recursive: true, mode: 0o700 })
const [action, label] = process.argv.slice(2)
if (!['issue','revoke'].includes(action ?? '') || !label || !/^[a-zA-Z0-9_-]{1,64}$/.test(label)) throw new Error('Usage: bun server/access.ts issue|revoke device-label')
const store = new AccessStore(join(dataDir, 'access.sqlite'))
if (action === 'revoke') { store.revoke(label); console.log('Access revoked.') }
else {
  const path = join(dataDir, `${label}.token`)
  const file = openSync(path, 'wx', 0o600)
  try { store.db.transaction(() => { writeFileSync(file, store.issue(label) + '\n') }).immediate() }
  catch (error) { unlinkSync(path); throw error }
  finally { closeSync(file) }
  console.log(`30-day access token saved to ${path}. Transfer privately; never bundle it.`)
}
store.db.close()
