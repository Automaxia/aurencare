import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { TranscricaoSessaoPDF } from '@/server/services/transcricaoSessaoPdf'
import { renderToStream } from '@react-pdf/renderer'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Exporta a transcrição completa da sessão em PDF (documento de apoio). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  try {
    const { rows } = await db.query<{
      numero: number; data_hora: string; transcricao_texto: string | null
      pac_nome: string; psi_nome: string; psi_crp: string
    }>(
      `SELECT s.numero, s.data_hora, s.transcricao_texto,
              p.nome AS pac_nome, ps.nome AS psi_nome, ps.crp AS psi_crp
         FROM sessoes s
         JOIN pacientes p ON p.id = s.paciente_id
         JOIN psicologos ps ON ps.id = s.psicologo_id
        WHERE s.id = $1 AND s.psicologo_id = $2 LIMIT 1`,
      [params.id, user.id],
    )
    const r = rows[0]
    if (!r) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })

    const turnos = parseTurnos(tryDecrypt(r.transcricao_texto) ?? '')
    const stream = await renderToStream(
      <TranscricaoSessaoPDF d={{
        psicologo: { nome: r.psi_nome, crp: r.psi_crp },
        pacienteNome: r.pac_nome, numero: r.numero, dataHora: r.data_hora, turnos,
      }} />,
    )
    const slug = slugify(r.pac_nome)
    const dataIso = new Date(r.data_hora).toISOString().slice(0, 10)
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="transcricao-${slug}-${dataIso}-n${r.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    log.err('transcricao.pdf', 'falha ao gerar', err)
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

function parseTurnos(raw: string): Array<{ who: 'psicologo' | 'paciente'; texto: string }> {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map(line => {
    const m = line.match(/^(P|C):\s*(.+)$/)
    if (m) return { who: m[1] === 'P' ? 'psicologo' as const : 'paciente' as const, texto: m[2] }
    return { who: 'paciente' as const, texto: line }
  })
}

function slugify(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'paciente'
}
