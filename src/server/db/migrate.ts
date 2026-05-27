import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente. Rode via `npm run migrate` (carrega .env.local via tsx --env-file).')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      run_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file])
    if (rows.length) {
      console.log(`✓ ${file} (já aplicada)`)
      continue
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`▸ aplicando ${file}…`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO _migrations(name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`✓ ${file} aplicada`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`✗ ${file} falhou:`, err)
      process.exit(1)
    } finally {
      client.release()
    }
  }

  await pool.end()
  console.log('— migrations concluídas —')
}

main().catch(err => { console.error(err); process.exit(1) })
