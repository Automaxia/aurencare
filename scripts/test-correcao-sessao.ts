/**
 * Teste de integração de `transferirRegistro` / `arquivarSessao` (correção de
 * sessão com registro) contra um Postgres REAL migrado — o que importa é SQL:
 * o registro mudar de dono por inteiro, a origem ficar vazia, o log existir e
 * o arquivo guardar a linha.
 *
 * Uso: mesmo container do test-excluir-sessao.ts, depois `npm run test:correcao`.
 * Recusa qualquer banco que não seja local e com "test" no nome.
 */
import { db } from '@/server/db/pool'
import { transferirRegistro, arquivarSessao } from '@/server/services/correcaoSessao'

function exigirBancoDeTeste() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('✗ DATABASE_URL ausente.'); process.exit(1) }
  const u = new URL(url)
  if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname) || !/test/i.test(u.pathname)) {
    console.error('✗ recusando rodar: só banco de teste local (host localhost e "test" no nome).'); process.exit(1)
  }
}
exigirBancoDeTeste()
process.env.ENCRYPTION_KEY ||= 'chave-de-teste-da-correcao-sessao'

let falhas = 0
function checa(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? '  ✓' : '  ✗'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!ok) falhas++
}
const tag = `t${Date.now().toString(36)}`
const aud = (confirmacao: string, motivo = 'registrei na paciente errada por engano') =>
  ({ motivo, confirmacao, ip: '127.0.0.1', userAgent: 'teste' })

async function main() {
  const { encrypt, tryDecrypt } = await import('@/server/lib/crypto')
  const { rows: [p] } = await db.query(
    `INSERT INTO psicologos (nome, crp, email, senha_hash) VALUES ('Dra Teste', $1, $2, 'x') RETURNING id`,
    [`CRP-${tag}`, `${tag}@teste.local`])
  const psi = p.id as string
  const pac = async (nome: string) => (await db.query(
    `INSERT INTO pacientes (psicologo_id, nome, telefone) VALUES ($1,$2,$3) RETURNING id`,
    [psi, nome, `11${Math.floor(Math.random() * 1e9)}`])).rows[0].id as string
  const ana = await pac('Ana Souza')
  const luiza = await pac('Luíza Lima')
  const sessao = async (pacienteId: string, numero: number, dia: number, campos: Record<string, any> = {}) => {
    const base: Record<string, any> = {
      psicologo_id: psi, paciente_id: pacienteId, numero, data_hora: new Date(2026, 10, dia, 14).toISOString(),
      valor: 150, status: 'agendada', pagamento_status: 'pendente', ...campos,
    }
    const cols = Object.keys(base)
    return (await db.query(`INSERT INTO sessoes (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
      cols.map(c => base[c]))).rows[0].id as string
  }
  const registro = () => ({
    status: 'concluida', assinada: true, assinatura_timestamp: new Date().toISOString(),
    transcricao_texto: encrypt('P: oi\nC: tudo bem'), resumo_curto: encrypt('resumo'), laudo: encrypt('laudo'),
    indicadores: JSON.stringify({ humor: { estado: 2, freq: 40 } }),
  })

  console.log('\n1. Guardas')
  {
    const errada = await sessao(ana, 1, 3, { ...registro(), pagamento_status: 'pago' })
    let r = await transferirRegistro(psi, errada, { pacienteId: luiza }, aud('Luíza Lima', 'curto'))
    checa('exige motivo', !r.ok)
    r = await transferirRegistro(psi, errada, { pacienteId: luiza }, aud('Ana Souza'))
    checa('transferir exige o nome do paciente de destino (não o da origem)', !r.ok)
    r = await arquivarSessao(psi, errada, aud('Luíza Lima'))
    checa('excluir exige o nome do paciente da sessão', !r.ok)
    r = await arquivarSessao(psi, errada, aud('Ana Souza'))
    checa('não exclui sessão paga', !r.ok)
    const vazia = await sessao(ana, 2, 4)
    r = await transferirRegistro(psi, vazia, { pacienteId: luiza }, aud('Luíza Lima'))
    checa('não transfere sessão vazia', !r.ok)
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM sessoes_correcoes_log WHERE psicologo_id = $1`, [psi])
    checa('nenhuma tentativa barrada gera log', rows[0].n === 0, `n=${rows[0].n}`)
  }

  console.log('\n2. Transferir criando sessão nova (paga fica na Ana)')
  {
    const { rows: [orig] } = await db.query(`SELECT id FROM sessoes WHERE paciente_id = $1 AND numero = 1`, [ana])
    const r = await transferirRegistro(psi, orig.id, { pacienteId: luiza }, aud('  luiza  LIMA '))
    checa('transferiu', r.ok, r.ok ? '' : r.erro)
    if (r.ok) {
      const { rows: [o] } = await db.query(`SELECT * FROM sessoes WHERE id = $1`, [orig.id])
      checa('origem ficou vazia', !o.transcricao_texto && !o.laudo && !o.resumo_curto && !o.assinada && !o.indicadores)
      checa('origem mantém pagamento', o.pagamento_status === 'pago' && Number(o.valor) === 150)
      checa('origem volta pra confirmada (paga)', o.status === 'confirmada', o.status)
      const { rows: [d] } = await db.query(`SELECT * FROM sessoes WHERE id = $1`, [r.sessaoDestinoId])
      checa('destino é da Luiza', d.paciente_id === luiza)
      checa('destino tem a transcrição', tryDecrypt(d.transcricao_texto) === 'P: oi\nC: tudo bem')
      checa('destino tem indicadores', d.indicadores?.humor?.freq === 40)
      checa('destino volta como rascunho', d.assinada === false && d.status === 'concluida')
      checa('destino sem cobrança', d.pagamento_status === 'isento' && Number(d.valor) === 0)
      checa('destino numerado', d.numero === 1, `numero=${d.numero}`)
      const { rows: logs } = await db.query(`SELECT * FROM sessoes_correcoes_log WHERE sessao_id = $1`, [orig.id])
      checa('log gravado', logs.length === 1 && logs[0].acao === 'transferir_registro' && logs[0].sessao_destino_id === r.sessaoDestinoId)
      checa('log congela o termo', /Luíza Lima/.test(logs[0].termo_texto) && /Ana Souza/.test(logs[0].termo_texto))
    }
  }

  console.log('\n3. Transferir pra sessão existente vazia')
  {
    const errada = await sessao(ana, 3, 10, registro())
    const alvo = await sessao(luiza, 2, 10)
    const r = await transferirRegistro(psi, errada, { pacienteId: luiza, sessaoId: alvo }, aud('Luíza Lima'))
    checa('transferiu pra sessão escolhida', r.ok && r.sessaoDestinoId === alvo, r.ok ? '' : r.erro)
    const ocupada = await sessao(luiza, 3, 12, registro())
    const outra = await sessao(ana, 4, 12, registro())
    const r2 = await transferirRegistro(psi, outra, { pacienteId: luiza, sessaoId: ocupada }, aud('Luíza Lima'))
    checa('recusa destino que já tem registro', !r2.ok)
  }

  console.log('\n4. Excluir (arquivar) sessão com registro')
  {
    const s = await sessao(ana, 5, 20, registro())
    const r = await arquivarSessao(psi, s, aud('Ana Souza'))
    checa('arquivou', r.ok, r.ok ? '' : r.erro)
    const { rows: viva } = await db.query(`SELECT id FROM sessoes WHERE id = $1`, [s])
    checa('saiu de sessoes', viva.length === 0)
    const { rows: arq } = await db.query(`SELECT * FROM sessoes_arquivadas WHERE id = $1`, [s])
    checa('cópia no arquivo', arq.length === 1 && tryDecrypt(arq[0].dados.laudo) === 'laudo')
    checa('arquivo aponta pro log', !!arq[0]?.correcao_id)
  }

  await db.query(`DELETE FROM sessoes_arquivadas WHERE psicologo_id = $1`, [psi])
  await db.query(`DELETE FROM psicologos WHERE id = $1`, [psi])
  await db.end()
  console.log(falhas ? `\n✗ ${falhas} falha(s)` : '\n✓ tudo certo')
  process.exit(falhas ? 1 : 0)
}

main().catch(async err => { console.error(err); await db.end().catch(() => {}); process.exit(1) })
