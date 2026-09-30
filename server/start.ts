import { mkdirSync, chmodSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { AccessStore } from './security'
import { createHandler } from './handler'
process.umask(0o077)
const dataDir = resolve(process.env.TRU_DATA_DIR || '.local')
mkdirSync(dataDir, { recursive: true, mode: 0o700 })
const databasePath = join(dataDir, 'access.sqlite')
const store = new AccessStore(databasePath)
chmodSync(databasePath, 0o600)
const server = Bun.serve({ hostname: process.env.TRU_LISTEN_HOST || '127.0.0.1', port: Number(process.env.PORT || 8788), maxRequestBodySize: 6000000, idleTimeout: 60, fetch: createHandler(store, process.env) })
console.log(`Tru service listening on ${server.url}. Put an HTTPS reverse proxy in front for devices.`)
