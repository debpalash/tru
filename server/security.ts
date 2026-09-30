import { Database } from 'bun:sqlite'
import { createHash, randomBytes } from 'node:crypto'

export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex') }
export class AccessStore {
  readonly db: Database
  constructor(path: string) {
    this.db = new Database(path, { create: true })
    this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, label TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS usage (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`)
  }
  issue(label: string, days = 30): string {
    const token = randomBytes(32).toString('base64url')
    this.db.query('INSERT INTO tokens VALUES (?, ?, ?)').run(tokenHash(token), label, Date.now() + days * 86400000)
    return token
  }
  revoke(label: string): void { this.db.query('DELETE FROM tokens WHERE label = ?').run(label) }
  authenticate(token: string): string | null {
    if (!/^[\w-]{43}$/.test(token)) return null
    const hash = tokenHash(token)
    return this.db.query('SELECT hash FROM tokens WHERE hash = ? AND expires > ?').get(hash, Date.now()) ? hash : null
  }
  consume(identity: string, cost = 1): boolean {
    const now = Date.now()
    const limits: [string, number, number][] = [
      [`minute:${identity}:${Math.floor(now / 60000)}`, 30, 60000],
      [`day:${identity}:${Math.floor(now / 86400000)}`, 300, 86400000],
      [`global:${Math.floor(now / 86400000)}`, 3000, 86400000],
    ]
    return this.db.transaction(() => {
      this.db.query('DELETE FROM usage WHERE expires < ?').run(now)
      for (const [key, limit] of limits) {
        const row = this.db.query('SELECT count FROM usage WHERE key = ?').get(key) as { count: number } | null
        if ((row?.count ?? 0) + cost > limit) return false
      }
      for (const [key, , period] of limits) this.db.query('INSERT INTO usage VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = count + excluded.count').run(key, cost, now + period)
      return true
    }).immediate()
  }
}
