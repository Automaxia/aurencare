/**
 * Relatório de silêncio por sessão (Tarefa 2a) — o gate antes de qualquer corte.
 * Lê sessoes.transcricao_stats (capturado no encerramento) e responde:
 *  - quanto de silêncio há por sessão (%, e minutos absolutos)
 *  - onde está: borda (pré/pós fala) vs meio (pausa terapêutica / psicólogo falando)
 *
 *   npm run relatorio:silencio
 *
 * ⚠️ Só reflete sessões encerradas APÓS o deploy da instrumentação (migration 040).
 * Sessões antigas têm transcricao_stats NULL e são ignoradas.
 *
 * Nota clínica: o stream da AssemblyAI é só o áudio do PACIENTE. O "meio" inclui
 * o tempo em que o psicólogo fala (silêncio do paciente ≠ silêncio real). Só a
 * borda pré-primeira-fala e pós-última-fala é seguramente ociosa. NÃO tratar o
 * silêncio do meio como cortável sem análise adicional.
 */
import { db } from '@/server/db/pool'

type Stats = { audioMs: number; speechMs: number; turnos: number; primeiroMs: number; ultimoMs: number }
const min = (ms: number) => (ms / 60000)
const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0)

async function main() {
  const { rows } = await db.query<{ id: string; stats: Stats }>(
    `SELECT id, transcricao_stats AS stats FROM sessoes
      WHERE transcricao_stats IS NOT NULL AND (transcricao_stats->>'audioMs')::numeric > 0
      ORDER BY data_hora DESC`)

  if (!rows.length) {
    console.log('Nenhuma sessão com métricas ainda. Rode após sessões encerrarem pós-deploy da 040.')
    await db.end(); return
  }

  let somaAudio = 0, somaSpeech = 0, somaBorda = 0, somaMeio = 0
  const linhas: any[] = []
  for (const r of rows) {
    const s = r.stats
    const bordaMs = s.primeiroMs + Math.max(0, s.audioMs - s.ultimoMs) // pré-1ª fala + pós-última
    const silencioMs = Math.max(0, s.audioMs - s.speechMs)
    const meioMs = Math.max(0, silencioMs - bordaMs)
    somaAudio += s.audioMs; somaSpeech += s.speechMs; somaBorda += bordaMs; somaMeio += meioMs
    linhas.push({
      id: r.id.slice(0, 8),
      audioMin: min(s.audioMs).toFixed(1),
      falaPct: pct(s.speechMs, s.audioMs).toFixed(0),
      silPct: pct(silencioMs, s.audioMs).toFixed(0),
      bordaMin: min(bordaMs).toFixed(1),
      meioMin: min(meioMs).toFixed(1),
      turnos: s.turnos,
    })
  }

  console.log(`\n=== ${rows.length} sessões com métricas ===`)
  console.log('sessão   | áudio(min) | fala% | silêncio% | borda(min) | meio(min) | turnos')
  for (const l of linhas)
    console.log(`${l.id} | ${l.audioMin.padStart(10)} | ${l.falaPct.padStart(4)}% | ${l.silPct.padStart(8)}% | ${l.bordaMin.padStart(10)} | ${l.meioMin.padStart(9)} | ${String(l.turnos).padStart(6)}`)

  const silTotal = somaAudio - somaSpeech
  console.log('\n=== AGREGADO ===')
  console.log(`Áudio total transmitido:   ${min(somaAudio).toFixed(1)} min`)
  console.log(`Fala do paciente:          ${min(somaSpeech).toFixed(1)} min (${pct(somaSpeech, somaAudio).toFixed(0)}%)`)
  console.log(`Silêncio total:            ${min(silTotal).toFixed(1)} min (${pct(silTotal, somaAudio).toFixed(0)}%)`)
  console.log(`  · borda (SEGURO cortar): ${min(somaBorda).toFixed(1)} min (${pct(somaBorda, somaAudio).toFixed(0)}% do áudio)`)
  console.log(`  · meio (psicólogo/pausa, NÃO cortar às cegas): ${min(somaMeio).toFixed(1)} min (${pct(somaMeio, somaAudio).toFixed(0)}%)`)
  console.log(`\nEconomia POTENCIAL só cortando bordas: ${pct(somaBorda, somaAudio).toFixed(0)}% do custo de transcrição.`)
  await db.end()
}
main().catch(e => { console.error(e); process.exit(1) })
