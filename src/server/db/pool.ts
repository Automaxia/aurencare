import 'server-only'
import { Pool } from 'pg'

const globalForDb = globalThis as unknown as { __aurenPool?: Pool }

export const db: Pool =
  globalForDb.__aurenPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.__aurenPool = db
