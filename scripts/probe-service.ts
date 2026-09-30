/** Minimal live provider checks. Never print credentials, prompts or upstream errors. */
import { AccessStore } from '../server/security'
import { createHandler } from '../server/handler'

const store = new AccessStore(':memory:')
const token = store.issue('release-check')
const handler = createHandler(store, process.env)
const status = await (await handler(new Request('https://release-check.invalid/v1/status', { headers: { Authorization: `Bearer ${token}` } }))).json() as { providers: string[]; media: boolean; web: boolean }
let failures = 0
for (const id of status.providers) {
  const response = await handler(new Request(`https://release-check.invalid/v1/chat/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 16 }) }))
  const result = await response.json() as { choices?: { message?: { content?: string } }[] }
  const ok = response.ok && Boolean(result.choices?.[0]?.message?.content?.trim())
  console.log(`${id}: ${ok ? 'PASS' : `FAIL (HTTP ${response.status}, no usable answer)`}`)
  if (!ok) failures++
}
console.log(`Web research: ${status.web ? 'configured (not yet live-tested)' : 'not configured'}`)
console.log(`Media: ${status.media ? 'configured (not yet live-tested)' : 'not configured'}`)
store.db.close()
if (!status.providers.length || failures) process.exitCode = 1
