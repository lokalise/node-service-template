/**
 * The users the read journeys draw from, created and deleted through the API by the runner
 * rather than in k6's `setup()` and `teardown()`: the runner measures what the k6 process
 * cost, and a hundred seed inserts and deletes would swamp the statement counts of a smoke
 * run and move with `SEED_USERS` while the code under test stays the same.
 */
import { randomUUID } from 'node:crypto'

const CONCURRENCY = 20

async function inBatches<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let offset = 0; offset < items.length; offset += CONCURRENCY) {
    results.push(...(await Promise.all(items.slice(offset, offset + CONCURRENCY).map(task))))
  }
  return results
}

const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` })

export async function seedUsers(baseUrl: string, token: string, count: number): Promise<string[]> {
  const health = await fetch(`${baseUrl}/health`).catch(() => undefined)
  if (health?.status !== 200) {
    throw new Error(
      `the service is not answering at ${baseUrl}/health (${health?.status ?? 'no response'}). Is the stack up?`,
    )
  }

  return inBatches(Array.from({ length: count }), async () => {
    const unique = `seed-${randomUUID()}`
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `Perf ${unique}`,
        email: `${unique}@perf.example.com`,
        age: 30,
        internalNote: 'created by the k6 load test',
      }),
    })
    if (response.status !== 201) {
      throw new Error(
        `seeding a user failed: ${response.status} ${(await response.text()).slice(0, 300)}`,
      )
    }
    const body = (await response.json()) as { data: { id: string } }
    return body.data.id
  })
}

/** Best effort: returns how many deletes failed, so a kept stack's leftovers are reported. */
export async function deleteUsers(
  baseUrl: string,
  token: string,
  userIds: string[],
): Promise<number> {
  const results = await inBatches(userIds, async (userId) => {
    const response = await fetch(`${baseUrl}/users/${userId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }).catch(() => undefined)
    return response?.status === 204
  })
  return results.filter((deleted) => !deleted).length
}
