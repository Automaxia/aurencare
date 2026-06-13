import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerCondicoesPaciente, ultimaSessaoAssinada } from '@/server/services/contexto'
import { buscarDadosCadastro } from '@/server/services/pacientes'
import { listarObjetivos } from '@/server/services/objetivos'
import { gerarMemoriaClinica } from '@/server/services/memoriaClinica'
import { tryDecrypt } from '@/server/lib/crypto'
import { formatPhone, formatDateBR } from '@/lib/formatters'
import { PatientProfileForm } from './profile-form'
import { DadosCadastroForm } from './DadosCadastroForm'
import { ConsentimentoPendente } from './ConsentimentoPendente'
import { ExportarProntuario } from './ExportarProntuario'
import { AcoesPaciente } from './AcoesPaciente'
import { OndeEstamos } from './OndeEstamos'
import { MemoriaClinica } from './MemoriaClinica'

export const dynamic = 'force-dynamic'

function haQuanto(iso: string): string {
  const dias = Math.floor((Date.now() - +new Date(iso)) / 86_400_000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const m = Math.floor(dias / 30)
  return `há ${m} ${m === 1 ? 'mês' : 'meses'}`
}
function quandoCurto(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}
function labelStatus(s: string): string {
  return ({
    agendada: 'Agendada', aguardando_metodo: 'Aguard. método', aguardando_pagamento: 'Aguard. pagamento',
    confirmada: 'Confirmada', em_curso: 'Em curso', concluida: 'Concluída',
    cancelada: 'Cancelada', no_show: 'Sem comparecimento',
  } as Record<string, string>)[s] ?? s
}
function statusTagClass(s: string, assinada: boolean): 'ok' | 'warn' | 'mute' | 'alert' | 'info' {
  if (s === 'concluida' && assinada) return 'ok'
  if (s === 'concluida' && !assinada) return 'warn'
  if (s === 'em_curso')             return 'info'
  if (s === 'cancelada' || s === 'no_show') return 'alert'
  if (s === 'confirmada')           return 'ok'
  return 'mute'
}
function resumoClinico(c: { cid?: string[]; medicacoes?: { nome: string }[]; alertas?: string[] } | null): string {
  if (!c) return 'Nenhuma registrada'
  const parts: string[] = []
  if (c.cid?.length)        parts.push(c.cid.slice(0, 2).join(', ') + (c.cid.length > 2 ? '…' : ''))
  if (c.medicacoes?.length) parts.push(c.medicacoes.map(m => m.nome).slice(0, 2).join(', ') + (c.medicacoes.length > 2 ? '…' : ''))
  if (c.alertas?.length)    parts.push(`${c.alertas.length} alerta${c.alertas.length > 1 ? 's' : ''}`)
  return parts.length ? parts.join(' · ') : 'Nenhuma registrada'
}

export default async function PacientePerfilPage({ params }: { params: { id: string } }) {
  const user = await requirePsicologo()
  const { rows } = await db.query<{ id: string; nome: string; telefone: string; email: string | null; psicologo_id: string; consentimento_aceito: boolean; status: string; created_at: string }>(
    'SELECT id, nome, telefone, email, psicologo_id, consentimento_aceito, status, created_at FROM pacientes WHERE id = $1 LIMIT 1',
    [params.id],
  )
  const p = rows[0]
  if (!p) notFound()
  if (p.psicologo_id !== user.id) redirect('/pacientes')

  const [condicoes, sessoesAssinadas, totalSessoes, dadosCadastro, objetivos, memoria, ultimaEvol, proximaRows, ultimaRows, historicoSessoes] = await Promise.all([
    lerCondicoesPaciente(params.id),
    db.query<{ id: string; numero: number; data_hora: string; modalidade: string; duracao_min: number }>(
      `SELECT id, numero, data_hora, modalidade, duracao_min
         FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE
        ORDER BY data_hora DESC LIMIT 40`, [params.id],
    ).then(r => r.rows.map(row => ({
      id: row.id, numero: row.numero, dataHora: row.data_hora, modalidade: row.modalidade, duracaoMin: row.duracao_min,
    }))),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM sessoes WHERE paciente_id = $1`, [params.id]).then(r => r.rows[0]?.n ?? 0),
    buscarDadosCadastro(user.id, params.id),
    listarObjetivos(params.id),
    gerarMemoriaClinica(params.id),
    ultimaSessaoAssinada(params.id),
    db.query<{ id: string; numero: number; data_hora: string }>(
      `SELECT id, numero, data_hora FROM sessoes
        WHERE paciente_id = $1 AND data_hora > NOW() AND status NOT IN ('cancelada','no_show')
        ORDER BY data_hora ASC LIMIT 1`, [params.id]).then(r => r.rows[0] ?? null),
    db.query<{ id: string; numero: number; data_hora: string }>(
      `SELECT id, numero, data_hora FROM sessoes
        WHERE paciente_id = $1 AND data_hora <= NOW()
        ORDER BY data_hora DESC LIMIT 1`, [params.id]).then(r => r.rows[0] ?? null),
    db.query<{ id: string; numero: number; data_hora: string; status: string; assinada: boolean; resumo_ia: string | null }>(
      `SELECT id, numero, data_hora, status, assinada, resumo_ia
         FROM sessoes WHERE paciente_id = $1
         AND status IN ('concluida','no_show','cancelada','confirmada','em_curso','agendada')
        ORDER BY data_hora DESC LIMIT 12`, [params.id]).then(r => r.rows),
  ])

  const arquivado = p.status === 'inativo'
  const objetivosAtivos = objetivos.filter(o => o.status === 'ativo')
  const temas = memoria.temasPredominantes

  // Subtítulo CLÍNICO (não mais cadastral)
  const sub: string[] = []
  if (ultimaRows) { sub.push(`Sessão ${ultimaRows.numero}`); sub.push(`última ${haQuanto(ultimaRows.data_hora)}`) }
  if (proximaRows) sub.push(`próxima ${quandoCurto(proximaRows.data_hora)}`)
  if (sub.length === 0) sub.push('Sem sessões ainda')

  return (
    <div>
      {arquivado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(122,117,144,.10)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)',
        }}>
          <span style={{ fontSize: 14 }}>⊘</span>
          Paciente arquivado. Reative em <strong>⋯ → Reativar</strong> pra voltar a aparecer nas listas.
        </div>
      )}

      <PageHeader
        title={p.nome}
        subtitle={sub.join(' · ')}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ExportarProntuario pacienteId={p.id} sessoesAssinadas={sessoesAssinadas} />
            <AcoesPaciente
              pacienteId={p.id}
              inicial={{ nome: p.nome, telefone: p.telefone, email: p.email, status: arquivado ? 'inativo' : 'ativo' }}
              totalSessoes={totalSessoes}
            />
          </div>
        }
      />

      {/* Status que merece atenção — pílulas só quando há exceção */}
      {!p.consentimento_aceito && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <ConsentimentoPendente pacienteId={p.id} />
        </div>
      )}

      <div className="briefing-grid">
        <OndeEstamos
          pacienteId={p.id}
          objetivos={objetivosAtivos.slice(0, 3).map(o => ({ id: o.id, titulo: o.titulo, progresso: o.progresso }))}
          totalObjetivosAtivos={objetivosAtivos.length}
          temas={temas}
          ultimaEvolucao={ultimaEvol ? { numero: ultimaEvol.numero, quando: haQuanto(ultimaEvol.dataHora), texto: ultimaEvol.bullets[0] ?? '' } : null}
          proximaSessaoId={proximaRows?.id ?? null}
        />
        <MemoriaClinica dados={memoria} pacienteId={p.id} />
      </div>

      <details className="bloco-recolhivel">
        <summary>
          <span>Histórico de sessões</span>
          <span className="resumo">{historicoSessoes.length} {historicoSessoes.length === 1 ? 'sessão' : 'sessões'}</span>
        </summary>
        <div className="bloco-conteudo">
          {historicoSessoes.length === 0 ? (
            <div className="empty">Sem sessões registradas ainda.</div>
          ) : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {historicoSessoes.map(s => {
                const resumo = tryDecrypt(s.resumo_ia)
                return (
                  <li key={s.id}>
                    <Link href={`/sessao/${s.id}`} className="card" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--f-display)', fontSize: 18, color: 'var(--ink-soft)' }}>#{s.numero}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDateBR(s.data_hora)}</span>
                        </div>
                        <span className={`tag t-${statusTagClass(s.status, s.assinada)}`}>{labelStatus(s.status)}</span>
                      </div>
                      {resumo && (
                        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {resumo}
                        </p>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </details>

      <details className="bloco-recolhivel" id="info-clinica">
        <summary>
          <span>Informações clínicas</span>
          <span className="resumo">{resumoClinico(condicoes)}</span>
        </summary>
        <div className="bloco-conteudo">
          <PatientProfileForm pacienteId={p.id} initial={condicoes} />
        </div>
      </details>

      <details className="bloco-recolhivel">
        <summary>
          <span>Dados cadastrais</span>
          <span className="resumo">{formatPhone(p.telefone)}{p.email ? ' · ' + p.email : ''}</span>
        </summary>
        <div className="bloco-conteudo">
          <DadosCadastroForm pacienteId={p.id} initial={dadosCadastro} />
        </div>
      </details>
    </div>
  )
}
