import { NextResponse } from 'next/server'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { importarSessao, gateImportarSessao } from '@/server/services/sessoes'
import { extrairTextoDeArquivo } from '@/server/lib/extrairTexto'
import { log } from '@/server/lib/log'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_BYTES = 12 * 1024 * 1024 // 12 MB

/**
 * Importa uma transcrição externa como sessão de histórico do paciente.
 * Aceita multipart: campo `arquivo` (.txt/.pdf/.docx) OU `texto` (colado),
 * `data` (YYYY-MM-DD) e opcional `numero`.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await requirePsicologo()

  // Paciente é do psicólogo logado?
  const { rows } = await db.query('SELECT 1 FROM pacientes WHERE id = $1 AND psicologo_id = $2', [params.id, user.id])
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Gate de cobrança do import — pass-through no beta; liga o modelo no go-live.
  const gate = await gateImportarSessao(user.id, params.id)
  if (!gate.ok) return NextResponse.json({ error: 'limite', ...gate }, { status: 402 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form_invalido' }, { status: 400 })

  const data = String(form.get('data') ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: 'data_invalida' }, { status: 400 })
  const numeroRaw = form.get('numero')
  const numero = numeroRaw ? parseInt(String(numeroRaw), 10) : null

  // Texto colado tem prioridade; senão extrai do arquivo.
  let texto = String(form.get('texto') ?? '').trim()
  if (!texto) {
    const arquivo = form.get('arquivo')
    if (!(arquivo instanceof File)) return NextResponse.json({ error: 'sem_conteudo' }, { status: 400 })
    if (arquivo.size > MAX_BYTES) return NextResponse.json({ error: 'arquivo_grande' }, { status: 400 })
    try {
      const buf = Buffer.from(await arquivo.arrayBuffer())
      texto = (await extrairTextoDeArquivo(arquivo.name, buf)).trim()
    } catch (err: any) {
      const code = err?.message === 'formato_nao_suportado' ? 'formato_nao_suportado'
        : err?.message === 'formato_doc_antigo' ? 'formato_doc_antigo'
        : 'falha_extracao'
      log.warn('importar-sessao', `extração falhou: ${code}`)
      return NextResponse.json({ error: code }, { status: 400 })
    }
  }

  if (texto.length < 40) return NextResponse.json({ error: 'texto_curto' }, { status: 400 })

  // Data no formato ISO (meio-dia local pra não escorregar de fuso).
  const dataHora = `${data}T12:00:00`
  try {
    const r = await importarSessao({
      psicologoId: user.id, pacienteId: params.id, dataHora,
      numero: Number.isFinite(numero) ? numero : null, transcricao: texto,
    })
    return NextResponse.json({ ok: true, sessaoId: r.sessaoId, numero: r.numero, temLaudo: !!r.laudo })
  } catch (err) {
    log.err('importar-sessao', `falha ao importar paciente=${params.id}`, err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
