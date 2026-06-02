import { requirePsicologo } from '@/server/lib/auth'
import { coletarRelatorioSessao } from '@/server/services/relatorioSessaoExport'
import { RelatorioSessaoPDF } from '@/server/services/relatorioSessaoPdf'
import { renderToStream } from '@react-pdf/renderer'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Exporta o Relatório de Sessão (formato RELATO2) em PDF.
 * Em conformidade com Resolução CFP nº 06/2019.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()

  try {
    const dados = await coletarRelatorioSessao(user.id, params.id)
    if (!dados) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      })
    }

    const stream = await renderToStream(<RelatorioSessaoPDF d={dados} />)
    const slug = slugify(dados.paciente.nome)
    const dataIso = new Date(dados.sessao.dataHora).toISOString().slice(0, 10)
    const filename = `relatorio-sessao-${slug}-${dataIso}-n${dados.sessao.numero}.pdf`

    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    log.err('relatorio.sessao.pdf', 'falha ao gerar', err)
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
