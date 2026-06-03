// Grandfather dos psicólogos beta: concede um plano de cortesia aos usuários
// que já existiam antes da virada paga, evitando que caiam em 'free' (3 sessões).
//
// Uso:
//   node --env-file=.env.local scripts/grandfather-beta.mjs <plano> <ate-ISO>
// Exemplo (Pro de cortesia até 31/12/2026):
//   node --env-file=.env.local scripts/grandfather-beta.mjs pro 2026-12-31
//
// Só afeta quem está hoje em 'free' (não mexe em quem já assinou).
import pg from 'pg'

const { Pool } = pg
const [, , planoArg, ateArg] = process.argv

const PLANOS_VALIDOS = ['essencial', 'pro']
if (!PLANOS_VALIDOS.includes(planoArg) || !ateArg) {
  console.error('Uso: node --env-file=.env.local scripts/grandfather-beta.mjs <essencial|pro> <YYYY-MM-DD>')
  process.exit(1)
}
const ate = new Date(ateArg)
if (Number.isNaN(+ate)) { console.error(`Data inválida: ${ateArg}`); process.exit(1) }

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente.'); process.exit(1) }

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const { rows } = await pool.query(
  `UPDATE psicologos
      SET plano = $1, plano_status = 'ativo', plano_ciclo = 'mensal',
          plano_expira_em = $2, plano_atualizado_em = NOW()
    WHERE plano = 'free'
    RETURNING id, nome, email`,
  [planoArg, ate.toISOString()],
)

console.log(`✓ ${rows.length} psicólogo(s) migrados para '${planoArg}' de cortesia até ${ateArg}:`)
for (const r of rows) console.log(`  · ${r.nome} <${r.email}>`)

await pool.end()
