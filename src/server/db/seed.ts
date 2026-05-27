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

    const transcS5 = `P: Como foi a semana com seu chefe?
C: Tensa. Toda reunião eu sinto ansiedade antes, e depois fico ruminando o que poderia ter dito de outra forma.
P: Notou alguma situação específica?
C: A apresentação de quinta. Meu chefe interrompeu duas vezes, e em vez de responder, fiquei calado. Saí com vergonha e raiva.
P: Esse padrão de evitação aparece em outros relacionamentos?
C: Com meu pai também. Sempre que tem conflito eu evito, depois rumino por dias.
P: O que você acha que sustenta essa evitação?
C: Medo de não ser bom o suficiente. Pensamento de que se eu não responder bem, vão me julgar.
P: Você consegue notar uma diferença em relação ao mês passado?
C: Sim. Antes nem aceitava reuniões. Hoje vou, mesmo com ansiedade.`
    const transcS4 = `P: O que ficou marcante da sessão passada?
C: A consciência de que o padrão com meu chefe espelha o padrão com meu pai. Trabalho e família estão conectados.
P: Você tentou alguma estratégia nesta semana?
C: Sim, na reunião de terça respirei antes de falar. Consegui colocar minha ideia, mesmo com o coração acelerado.
P: O que você notou em seu corpo nesse momento?
C: Tensão nos ombros, mas também um certo orgulho depois.
P: Sua família percebeu alguma mudança?
C: Minha esposa elogiou. Disse que pareço menos rumiando à noite.`
    const transcS6 = `P: Como foi a apresentação?
C: Fui. Tinha medo, mas fiz. O chefe inclusive elogiou.
P: O que mudou desde a primeira sessão?
C: Antes a evitação dominava. Agora eu noto a ansiedade chegando e ainda assim escolho responder.
P: Você consegue nomear esse padrão de evitação?
C: Medo de julgamento. Aparece no trabalho, com meu pai, e às vezes com minha esposa.
P: E a ruminação?
C: Diminuiu muito. Antes ficava acordado pensando, agora consigo dormir.`

    const seeds = [
      { pacIdx: 0, num: 7, deltaH: 2,           status: 'agendada',   pag: 'pendente',  metodo: null,       valor: 220 },
      { pacIdx: 0, num: 6, deltaH: -3 * 24,     status: 'concluida',  pag: 'pago',      metodo: 'pix',      valor: 220, assinada: true,  resumo: 'Sessão #6 com Fernanda K. — observa-se redução da ruminação noturna e frequência crescente de respostas assertivas em contextos profissionais. Padrão de evitação ainda presente, porém com menor intensidade que nas sessões #1-#3.', transcricao: transcS6 },
      { pacIdx: 0, num: 5, deltaH: -10 * 24,    status: 'concluida',  pag: 'pago',      metodo: 'pix',      valor: 220, assinada: true,  resumo: 'Sessão #5 com Fernanda K. — articulação consciente entre padrão profissional e familiar. Frequência crescente de uso de respiração antes de responder em situações tensas.', transcricao: transcS5 },
      { pacIdx: 0, num: 4, deltaH: -17 * 24,    status: 'concluida',  pag: 'pago',      metodo: 'pix',      valor: 220, assinada: true,  resumo: 'Sessão #4 com Fernanda K. — tentativa concreta de estratégia em reunião de trabalho. Co-ocorrência observada entre tensão corporal e exposição.', transcricao: transcS4 },
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
