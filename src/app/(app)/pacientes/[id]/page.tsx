import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { db } from '@/server/db/pool'
import { lerCondicoesPaciente, ultimaSessaoAssinada } from '@/server/services/contexto'
import { buscarDadosCadastro } from '@/server/services/pacientes'
import { listarObjetivos } from '@/server/services/objetivos'
import { gerarMemoriaClinica } from '@/server/services/memoriaClinica'
import { formatPhone } from '@/lib/formatters'
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

  const [condicoes, sessoesAssinadas, totalSessoes, dadosCadastro, objetivos, memoria, ultimaEvol, proximaRows, ultimaRows] = await Promise.all([
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
  ])

  const arquivado = p.status === 'inativo'
  const objetivosAtivos = objetivos.filter(o => o.status === 'ativo')
  const temas = memoria.temasPredominantes
  const alertas = condicoes?.alertas ?? []

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
      {(alertas.length > 0 || !p.consentimento_aceito) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {alertas.length > 0 && (
            <a href="#info-clinica" style={{ fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 999, background: 'rgba(196,96,122,.12)', color: 'var(--rose)', textDecoration: 'none' }}>
              ⚠ {alertas.length} alerta{alertas.length > 1 ? 's' : ''} clínico{alertas.length > 1 ? 's' : ''} →
            </a>
          )}
          {!p.consentimento_aceito && <ConsentimentoPendente pacienteId={p.id} />}
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

      <details className="bloco-recolhivel" id="info-clinica" open>
        <summary>
          <span>Informações clínicas</span>
          <span className="resumo">{resumoClinico(condicoes)}</span>
        </summary>
        <div className="bloco-conteudo">
          <PatientProfileForm pacienteId={p.id} initial={condicoes} />
        </div>
      </details>

      <details className="bloco-recolhivel" open>
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
