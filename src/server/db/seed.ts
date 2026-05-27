import bcrypt from 'bcrypt'
import { Pool } from 'pg'
import { randomUUID, createHash, createCipheriv, randomBytes } from 'node:crypto'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ausente. Rode via `npm run seed`.')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const email = 'ana@aurencare.com'
  const senha = 'auren123'
  const hash = await bcrypt.hash(senha, 10)

  // upsert psicóloga demo
  const { rows: pRows } = await pool.query(
    `INSERT INTO psicologos (nome, crp, email, senha_hash, wa_instancia, valor_sessao)
     VALUES ('Ana Pereira', 'CRP 06/12345', $1, $2, 'auren-care', 220.00)
     ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash
     RETURNING id`,
    [email, hash],
  )
  const psicologoId = pRows[0].id
  console.log(`✓ psicóloga demo: ${email} / ${senha}`)

  // 3 pacientes fictícios
  const pacientes = [
    { nome: 'Fernanda K.',    tel: '11999990001', email: 'fernanda@example.com', aceito: true  },
    { nome: 'Roberto M.',     tel: '11999990002', email: null,                   aceito: true  },
    { nome: 'Mariana L.',     tel: '11999990003', email: 'mariana@example.com',  aceito: false },
  ]
  const pacienteIds: string[] = []
  for (const p of pacientes) {
    const token = randomUUID().replace(/-/g, '').slice(0, 24)
    const { rows } = await pool.query(
      `INSERT INTO pacientes (psicologo_id, nome, telefone, email,
         consentimento_aceito, consentimento_timestamp, consentimento_token)
       VALUES ($1, $2, $3, $4, $5, ${p.aceito ? 'NOW()' : 'NULL'}, $6)
       ON CONFLICT (psicologo_id, telefone) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [psicologoId, p.nome, p.tel, p.email, p.aceito, token],
    )
    pacienteIds.push(rows[0].id)
  }
  console.log(`✓ ${pacientes.length} pacientes fictícios`)

  // 5 sessões em estados variados (apenas se ainda não houver)
  const { rows: existing } = await pool.query(
    'SELECT count(*)::int AS c FROM sessoes WHERE psicologo_id = $1',
    [psicologoId],
  )
  if (existing[0].c === 0) {
    const now = new Date()
    const day = 24 * 60 * 60 * 1000

    // simple inline encrypt para semear texto encriptado
    const key = (() => {
      const raw = process.env.ENCRYPTION_KEY ?? 'seed-fallback'
      return /^[0-9a-fA-F]{64}$/.test(raw)
        ? Buffer.from(raw, 'hex')
        : createHash('sha256').update(raw).digest()
    })()
    const enc = (plain: string) => {
      const iv = randomBytes(12)
      const c = createCipheriv('aes-256-gcm', key, iv)
      const e = Buffer.concat([c.update(plain, 'utf8'), c.final()])
      const tag = c.getAuthTag()
      return `v1:${iv.toString('base64')}:${e.toString('base64')}:${tag.toString('base64')}`
    }

    const seeds = [
      { pacIdx: 0, num: 7, deltaH: 2,           status: 'agendada',   pag: 'pendente',  metodo: null,       valor: 220 },
      { pacIdx: 0, num: 6, deltaH: -3 * 24,     status: 'concluida',  pag: 'pago',      metodo: 'pix',      valor: 220, assinada: true,  resumo: 'Trabalhou padrão de evitação em contexto profissional. Frequência crescente de auto-observação.', transcricao: 'P: Como foi a semana?\nC: Tive a apresentação que vinha adiando.' },
      { pacIdx: 1, num: 4, deltaH: 1 * 24 + 5,  status: 'confirmada', pag: 'pago',      metodo: 'credito', valor: 220 },
      { pacIdx: 1, num: 3, deltaH: -7 * 24,     status: 'concluida',  pag: 'pago',      metodo: 'credito', valor: 220, assinada: false },
      { pacIdx: 2, num: 1, deltaH: 4 * 24,      status: 'aguardando_metodo', pag: 'pendente', metodo: null, valor: 220 },
    ]
    for (const s of seeds) {
      const dt = new Date(now.getTime() + s.deltaH * 60 * 60 * 1000)
      await pool.query(
        `INSERT INTO sessoes (psicologo_id, paciente_id, numero, data_hora,
           status, pagamento_status, pagamento_metodo, valor,
           assinada, resumo_ia, transcricao_texto)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          psicologoId, pacienteIds[s.pacIdx], s.num, dt.toISOString(),
          s.status, s.pag, s.metodo, s.valor,
          (s as any).assinada ?? false,
          (s as any).resumo ? enc((s as any).resumo) : null,
          (s as any).transcricao ? enc((s as any).transcricao) : null,
        ],
      )
    }
    console.log(`✓ ${seeds.length} sessões de exemplo`)
  } else {
    console.log(`✓ sessões já populadas (${existing[0].c})`)
  }

  await pool.end()
  console.log('— seed concluído —')
}

main().catch(err => { console.error(err); process.exit(1) })
