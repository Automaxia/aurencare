import { requirePsicologo } from '@/server/lib/auth'
import { coletarExportacaoMensal, montarCsv } from '@/server/services/exportacaoContabil'
import { ExportacaoContabilPDF } from '@/server/services/exportacaoContabilPdf'
import { renderToStream } from '@react-pdf/renderer'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/financeiro/exportar?mes=YYYY-MM&formato=csv|pdf
 *
 * Devolve:
 *  - CSV (text/csv) com BOM UTF-8 pra Excel abrir certo
 *  - PDF (application/pdf) com layout institucional
 *
 * Default: mês atual em PDF.
 */
export async function GET(req: Request) {
  const user = await requirePsicologo()
  const url = new URL(req.url)
  const mesParam = url.searchParams.get('mes')  // YYYY-MM
  const formato = (url.searchParams.get('formato') ?? 'pdf').toLowerCase()

  const hoje = new Date()
  let ano = hoje.getFullYear()
  let mesIdx = hoje.getMonth()
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [y, m] = mesParam.split('-').map(Number)
    ano = y
    mesIdx = m - 1
  }

  try {
    const d = await coletarExportacaoMensal(user.id, ano, mesIdx)
    if (!d) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      })
    }

    const slug = slugify(d.psicologo.nome)
    const mesIso = `${ano}-${String(mesIdx + 1).padStart(2, '0')}`

    if (formato === 'csv') {
      const csv = montarCsv(d)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="financeiro-${slug}-${mesIso}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // PDF default
    const stream = await renderToStream(<ExportacaoContabilPDF d={d} />)
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="financeiro-${slug}-${mesIso}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    log.err('financeiro.exportar', 'falha', err)
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
    .slice(0, 60) || 'usuario'
}
