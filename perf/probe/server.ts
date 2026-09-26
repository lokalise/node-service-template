/**
 * What the database did, over HTTP.
 *
 *   node --run perf:probe          # on its own, port 3323
 *
 *   GET /db-stats                  counters
 *   GET /db-stats?statements=all   plus every statement, which the runner diffs across a run
 *   GET /db-stats?top=10           plus the ten that cost the most database time since the
 *                                  container started, migrations included
 *   GET /health                    the runner's health gate
 *
 * It exists because a k6 run can see one end of a request and not the other. A latency
 * budget says a request took 8 ms; nothing in a k6 summary says it cost 12 statements, and a
 * write path that issues one statement per row passes every timing threshold on a laptop
 * with an empty database. The runner reads it before and after a k6 run and reports the
 * difference.
 *
 * A route rather than a connection, because k6 has no database client without a custom
 * binary. Exact statement counts need `pg_stat_statements`, which docker-compose.perf.yml
 * preloads and postgres-init.sh creates.
 */
import { createDbProbeServer, readPostgresStats } from '@lokalise/load-testing-utils/db-probe'
import postgres from 'postgres'

const PORT = Number(process.env.PERF_PROBE_PORT ?? '3323')
const HOST = process.env.PERF_PROBE_BIND_ADDRESS ?? '127.0.0.1'
const POSTGRES_URL = process.env.PERF_PROBE_POSTGRES_URL ?? process.env.DATABASE_URL

if (!POSTGRES_URL) {
  throw new Error('PERF_PROBE_POSTGRES_URL or DATABASE_URL must be set')
}

const pg = postgres(POSTGRES_URL, { max: 2, idle_timeout: 20, onnotice: () => {} })

const server = createDbProbeServer({
  engines: {
    Postgres: (top) => readPostgresStats(pg, top),
  },
})

server.listen(PORT, HOST, () => {
  console.log(`[probe] listening on http://localhost:${PORT}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void pg.end().then(() => process.exit(0))
    })
  })
}
