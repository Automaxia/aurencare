/**
 * Bloco de contexto estruturado da sessão (checagem de humor + trechos marcados
 * pelo psicólogo) que acompanha a transcrição nos prompts de resumo/laudo.
 * Sem isso, o que o psicólogo registrou nos widgets ficava fora do resumo.
 */

const EMO: Record<number, string> = {
  [-5]: 'Extremamente desagradável', [-4]: 'Muito desagradável', [-3]: 'Desagradável',
  [-2]: 'Levemente desagradável', [-1]: 'Pouco desagradável', 0: 'Neutro',
  1: 'Pouco agradável', 2: 'Levemente agradável', 3: 'Agradável',
  4: 'Muito agradável', 5: 'Extremamente agradável',
}
const ESCALAS = {
  freq: [[0, 'Nunca'], [20, 'Algumas vezes'], [40, 'Diariamente'], [60, 'Muitas vezes ao dia'], [85, 'O tempo todo']],
  int:  [[0, 'Nenhum'], [25, 'Leve'], [50, 'Moderado'], [75, 'Forte'], [90, 'Extremo']],
  dur:  [[0, 'Sem humor'], [15, '1h ou menos'], [35, '2–4 horas'], [55, '8–12 horas'], [75, '1–2 dias'], [90, '7 dias']],
} as const
const MARK: Record<string, string> = {
  insight: 'Insight relevante', comportamento: 'Comportamento problema', avanco: 'Avanço terapêutico',
}

function escala(key: keyof typeof ESCALAS, v: unknown): string | null {
  if (typeof v !== 'number') return null
  let out: string = ESCALAS[key][0][1]
  for (const [n, l] of ESCALAS[key]) if (v >= n) out = l
  return out
}
function momento(m: any): string | null {
  if (!m || typeof m !== 'object') return null
  const t = String(m.texto ?? '').trim()
  return t ? `${t} (intensidade ${m.intensidade ?? '?'}/5)` : null
}
const esc = (s: string) => s.replace(/</g, '‹')

export function contextoSessaoXml(transcricao: string, indicadores: any): string {
  if (!indicadores || typeof indicadores !== 'object') return ''
  const partes: string[] = []

  const h = indicadores.humor
  if (h && typeof h === 'object') {
    const linhas = [
      typeof h.estado === 'number' ? `Estado emocional na semana: ${h.estado > 0 ? '+' : ''}${h.estado} (${EMO[h.estado] ?? '—'})` : null,
      momento(h.predominante) && `Humor predominante: ${momento(h.predominante)}`,
      momento(h.inicio) && `Início da sessão: ${momento(h.inicio)}`,
      momento(h.fim) && `Final da sessão: ${momento(h.fim)}`,
      escala('freq', h.freq) && `Frequência: ${escala('freq', h.freq)}`,
      escala('int', h.int) && `Intensidade: ${escala('int', h.int)}`,
      escala('dur', h.dur) && `Duração: ${escala('dur', h.dur)}`,
    ].filter(Boolean)
    if (linhas.length) partes.push(`  <mood_check registrado_pelo="psicologo">\n${linhas.map(l => `    ${esc(l as string)}`).join('\n')}\n  </mood_check>`)
  }

  const marc = Array.isArray(indicadores.marcacoes) ? indicadores.marcacoes : []
  if (marc.length) {
    const linhas = transcricao.split('\n').filter(Boolean)
    const trechos = marc
      .filter((m: any) => Number.isInteger(m?.idx) && MARK[m?.mark] && linhas[m.idx])
      .slice(0, 30)
      .map((m: any) => {
        const ctx = linhas.slice(Math.max(0, m.idx - 1), m.idx + 2).join('\n')
        return `    <segment tipo="${MARK[m.mark]}">\n${esc(ctx.slice(0, 1_500))}\n    </segment>`
      })
    if (trechos.length) partes.push(`  <marked_segments registrado_pelo="psicologo">\n${trechos.join('\n')}\n  </marked_segments>`)
  }

  if (!partes.length) return ''
  return `<clinician_inputs>
${partes.join('\n')}
</clinician_inputs>
Os dados acima foram registrados pelo próprio psicólogo durante a sessão. Considere-os no registro: a checagem de humor deve aparecer junto ao estado emocional, e cada trecho marcado deve ser contemplado de forma destacada (com o tipo da marcação).

`
}
