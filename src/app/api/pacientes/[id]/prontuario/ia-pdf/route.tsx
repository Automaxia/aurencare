import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { ProntuarioIaPDF } from '@/server/services/prontuarioIaPdf'
import { renderToStream } from '@react-pdf/renderer'
import { createHash } from 'node:crypto'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Recebe POST { texto: string, titulo?: string } e devolve PDF.
 * Texto é o resultado final aprovado pela psicóloga (com refinamentos
 * feitos via chat). PDF tem branding Audere + assinatura do(a) psicólogo(a).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()

  const { rows } = await db.query<{
    nome: string; cadastradoEm: string;
    psi_nome: string; psi_crp: string; psi_email: string; psi_telefone: string | null;
  }>(
    `SELECT p.nome, p.created_at AS "cadastradoEm",
            ps.nome AS psi_nome, ps.crp AS psi_crp, ps.email AS psi_email, ps.telefone AS psi_telefone
       FROM pacientes p JOIN psicologos ps ON ps.id = p.psicologo_id
      WHERE p.id = $1 AND p.psicologo_id = $2 LIMIT 1`,
    [params.id, user.id],
  )
  if (rows.length === 0) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({} as any))
  const texto = String(body?.texto ?? '').trim()
  const titulo = body?.titulo ? String(body.titulo).slice(0, 120) : undefined
  if (texto.length < 20) {
    return new Response(JSON.stringify({ error: 'texto_curto' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const r = rows[0]
    const geradoEm = new Date().toISOString()
    const hash = createHash('sha256').update(texto + '|' + r.nome + '|' + geradoEm).digest('hex').slice(0, 32)

    const stream = await renderToStream(
      <ProntuarioIaPDF
        psicologo={{ nome: r.psi_nome, crp: r.psi_crp, email: r.psi_email, telefone: r.psi_telefone }}
        paciente={{ nome: r.nome, cadastradoEm: r.cadastradoEm }}
        texto={texto}
        titulo={titulo}
        hash={hash}
        geradoEm={geradoEm}
      />,
    )

    const slug = slugify(r.nome)
    const dataIso = new Date().toISOString().slice(0, 10)
    const filename = `prontuario-narrativa-${slug}-${dataIso}.pdf`

    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    log.err('prontuario.ia.pdf', 'falha ao gerar', err)
    return new Response(JSON.stringify({ error: 'internal' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'paciente'
}
