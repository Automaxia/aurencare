'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/feedback/Toast'
import { criarSessaoAction, criarSerieAction, conflitosSerieAction } from './actions'
import { formatBRL, horarioBrasiliaParaISO, TZ } from '@/lib/formatters'
import { ValorInput } from '@/components/form/ValorInput'

type Modo = 'avulsa' | 'serie'
type Frequencia = 'semanal' | 'quinzenal'


export function NewSessionForm({ pacientes }: { pacientes: { id: string; nome: string }[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const today = new Date()
  const defaultDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [modo, setModo] = useState<Modo>('avulsa')
  const [pacienteId, setPacienteId] = useState(pacientes[0]?.id ?? '')
  const [data, setData] = useState(defaultDate)
  const [hora, setHora] = useState('14:00')
  const [duracao, setDuracao] = useState(50)
  const [modalidade, setModalidade] = useState('online')
  const [valor, setValor] = useState(220)
  const [gratuita, setGratuita] = useState(false)

  // Série
  const [frequencia, setFrequencia] = useState<Frequencia>('semanal')
  const [quantidade, setQuantidade] = useState(4)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflitos, setConflitos] = useState<Set<string>>(new Set())
  const [conflitoCheckFalhou, setConflitoCheckFalhou] = useState(false)
  const [datasPreview, setDatasPreview] = useState<string[]>([])

  // Recalcula preview sempre que entradas da série mudam
  useEffect(() => {
    if (modo !== 'serie') { setDatasPreview([]); setConflitos(new Set()); return }
    const iso = isoLocal(data, hora)
    if (!iso) return
    const datas: string[] = []
    const passo = frequencia === 'semanal' ? 7 : 14
    for (let i = 0; i < quantidade; i++) {
      const d = new Date(iso)
      d.setDate(d.getDate() + i * passo)
      datas.push(d.toISOString())
    }
    setDatasPreview(datas)
    // Busca conflitos no backend. Se falhar, AVISA — não pode parecer que checou.
    setConflitoCheckFalhou(false)
    conflitosSerieAction(datas)
      .then(c => { setConflitos(new Set(c)); setConflitoCheckFalhou(false) })
      .catch(() => { setConflitos(new Set()); setConflitoCheckFalhou(true) })
  }, [modo, data, hora, frequencia, quantidade])

  const diaSemana = (() => {
    const iso = isoLocal(data, hora); if (!iso) return ''
    return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: TZ })
  })()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const iso = isoLocal(data, hora)
    if (!iso) { setError('Data/hora inválida.'); setLoading(false); return }

    if (modo === 'avulsa') {
      const r = await criarSessaoAction({ pacienteId, dataHora: iso, duracaoMin: duracao, modalidade, valor })
      setLoading(false)
      if (r.ok) { toast('Sessão agendada'); router.push('/agenda') }
      else setError(r.error)
    } else {
      const r = await criarSerieAction({
        pacienteId, primeiraSessaoIso: iso, frequencia, quantidade,
        duracaoMin: duracao, modalidade, valor,
      })
      setLoading(false)
      if (r.ok) { toast(`Série de ${quantidade} sessões agendada`); router.push('/agenda') }
      else setError(r.error)
    }
  }

  const nomePaciente = pacientes.find(p => p.id === pacienteId)?.nome ?? '—'
  const { dia: diaResumo, hora: horaResumo } = (() => {
    const iso = isoLocal(data, hora); if (!iso) return { dia: '—', hora: '—' }
    const d = new Date(iso)
    return {
      dia: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: TZ }),
      hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    }
  })()
  const passos = gratuita
    ? ['O paciente recebe a confirmação no WhatsApp, sem pedido de pagamento.', 'A sessão já entra na agenda como confirmada.']
    : [
      `O paciente recebe no WhatsApp a pergunta de como prefere pagar${modo === 'serie' ? ' — uma por sessão, perto da data' : ''}.`,
      'Ele responde e o link (ou o QR do PIX) chega na hora.',
      'A sessão confirma sozinha quando o pagamento entra.',
    ]
  if (modalidade === 'online') passos.push('O link da sala de vídeo vai ~15 minutos antes do horário.')
  const nSessoes = modo === 'serie' ? quantidade : 1

  return (
    <div className="form-split">
    <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <ModoBtn ativo={modo === 'avulsa'} onClick={() => setModo('avulsa')}>Sessão avulsa</ModoBtn>
        <ModoBtn ativo={modo === 'serie'}  onClick={() => setModo('serie')}>Série recorrente</ModoBtn>
      </div>

      <Field label="Paciente">
        <select value={pacienteId} onChange={e => setPacienteId(e.target.value)} required>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label={modo === 'serie' ? 'Primeira sessão (data)' : 'Data'}>
          <input type="date" value={data} onChange={e => setData(e.target.value)} required />
        </Field>
        <Field label="Hora"><input type="time" value={hora} onChange={e => setHora(e.target.value)} required /></Field>
      </div>

      {modo === 'serie' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Frequência">
              <select value={frequencia} onChange={e => setFrequencia(e.target.value as Frequencia)}>
                <option value="semanal">Semanal — toda {diaSemana || 'semana'}</option>
                <option value="quinzenal">Quinzenal — {diaSemana || 'sem.'} sim, {diaSemana || 'sem.'} não</option>
              </select>
            </Field>
            <Field label="Quantidade de sessões">
              <input type="number" min={2} max={52} value={quantidade} onChange={e => setQuantidade(Math.max(2, +e.target.value || 0))} />
            </Field>
          </div>

          {datasPreview.length > 0 && (
            <div style={{
              padding: '12px 14px', borderRadius: 8, background: 'var(--surface)',
              fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.7,
            }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Previsão · {datasPreview.length} sessões
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {datasPreview.map((d, i) => {
                  const conflito = conflitos.has(d)
                  return (
                    <div key={d} style={{ color: conflito ? 'var(--rose)' : 'var(--ink-soft)' }}>
                      {i + 1}. {formatarPreview(d)} {conflito && <span style={{ fontSize: 10 }}>· conflito</span>}
                    </div>
                  )
                })}
              </div>
              {conflitos.size > 0 && (
                <div style={{ marginTop: 10, color: 'var(--rose)', fontSize: 11 }}>
                  Existe(m) {conflitos.size} sessão(ões) no mesmo horário. Confirme antes de salvar.
                </div>
              )}
              {conflitoCheckFalhou && (
                <div style={{ marginTop: 10, color: 'var(--amber)', fontSize: 11 }}>
                  ⚠ Não foi possível verificar conflitos de horário agora — confira a agenda manualmente antes de salvar.
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Duração (min)"><input type="number" value={duracao} onChange={e => setDuracao(+e.target.value)} min={15} max={180} step={5} /></Field>
        <Field label="Modalidade">
          <select value={modalidade} onChange={e => setModalidade(e.target.value)}>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </select>
        </Field>
        {/* Curto de propósito: "Valor por sessão (R$)" quebrava em 2 linhas e
            desalinhava a coluna. O campo já mostra o "R$". */}
        <Field label={modo === 'serie' ? 'Valor/sessão' : 'Valor'}>
          <ValorInput value={gratuita ? 0 : valor} onChange={v => setValor(v ?? 0)} disabled={gratuita} />
        </Field>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={gratuita}
        onClick={() => { const v = !gratuita; setGratuita(v); if (v) setValor(0) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, width: '100%',
          padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
          border: `1px solid ${gratuita ? 'var(--sage)' : 'var(--field-border)'}`,
          background: gratuita ? 'rgba(90,158,138,.08)' : 'var(--field-bg)',
          transition: 'border-color .15s var(--ease), background .15s var(--ease)',
        }}
      >
        <span style={{
          width: 36, height: 21, borderRadius: 999, flex: 'none', position: 'relative',
          background: gratuita ? 'var(--sage)' : 'var(--faint)', transition: 'background .15s var(--ease)',
        }}>
          <span style={{
            position: 'absolute', top: 2, left: gratuita ? 17 : 2, width: 17, height: 17,
            borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
            transition: 'left .15s var(--ease)',
          }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', display: 'block' }}>Sessão gratuita</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 1 }}>
            {gratuita ? 'Sem cobrança — o paciente não recebe pedido de pagamento.' : 'Por padrão, a sessão é cobrada do paciente.'}
          </span>
        </span>
      </button>

      {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        {modo === 'serie' && datasPreview.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 'auto' }}>
            Total: {formatBRL(valor * datasPreview.length)}
          </span>
        )}
        <a href="/agenda" className="btn ghost">Cancelar</a>
        <button type="submit" className="btn primary" disabled={loading}>
          {loading
            ? (modo === 'serie' ? 'Agendando série…' : 'Agendando…')
            : modo === 'serie'
              ? `Agendar ${quantidade} sessões`
              : 'Agendar e enviar WhatsApp'}
        </button>
      </div>

      <style jsx>{`
        /* altura/borda/foco: base de campos em globals.css */
        input, select { width: 100%; }
      `}</style>
    </form>

      <aside className="card resumo" aria-label="Resumo do agendamento">
        <div className="field-lbl">{modo === 'serie' ? 'Primeira sessão' : 'Resumo'}</div>

        <div className="quando">
          <span className="hora">{horaResumo}</span>
          <span className="dia">{diaResumo}</span>
        </div>
        <div className="quem">{nomePaciente}</div>

        <div className="chips">
          <span className="tag">{duracao} min</span>
          <span className="tag">{modalidade === 'online' ? 'Online' : 'Presencial'}</span>
          {modo === 'serie' && <span className="tag t-info">{quantidade}× {frequencia}</span>}
          <span className={`tag ${gratuita ? 't-ok' : ''}`}>
            {gratuita ? 'Gratuita' : nSessoes > 1 ? `${formatBRL(valor)}/sessão · ${formatBRL(valor * nSessoes)}` : formatBRL(valor)}
          </span>
        </div>

        <div className="passos">
          <div className="field-lbl">Ao agendar</div>
          <ol>
            {passos.map(t => <li key={t}>{t}</li>)}
          </ol>
        </div>

        <style jsx>{`
          .resumo { display: grid; gap: 10px; align-content: start; }
          .quando { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 2px; }
          .hora { font-family: var(--font-display), Georgia, serif; font-size: 44px; line-height: 1; font-weight: 400; color: var(--ink); letter-spacing: -.01em; }
          .dia { font-size: 13px; color: var(--ink-soft); }
          .dia::first-letter { text-transform: uppercase; }
          .quem { font-size: 14px; color: var(--ink); font-weight: 500; }
          .chips { display: flex; gap: 6px; flex-wrap: wrap; }
          /* .tag base é transparente; aqui as neutras ganham o fundo areia. */
          .chips .tag:not(.t-ok):not(.t-info) { background: var(--surface); color: var(--ink-soft); }
          .passos { border-top: 1px solid var(--border); padding-top: 14px; margin-top: 6px; display: grid; gap: 10px; }
          ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
          li {
            position: relative; padding: 0 0 12px 20px;
            font-size: 12.5px; line-height: 1.5; color: var(--ink-soft);
          }
          li::before {
            content: ''; position: absolute; left: 0; top: 5px;
            width: 8px; height: 8px; border-radius: 50%;
            background: var(--card); border: 1.5px solid var(--accent);
          }
          li:not(:last-child)::after {
            content: ''; position: absolute; left: 3.5px; top: 15px; bottom: 1px;
            width: 1px; background: rgba(106,78,200,.2);
          }
          li:last-child { padding-bottom: 0; }
        `}</style>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-lbl">{label}</span>
      {children}
    </label>
  )
}

function ModoBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        flex: 1, padding: '9px 12px', borderRadius: 999,
        border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`,
        background: ativo ? 'rgba(106,78,200,.10)' : 'transparent',
        color: ativo ? '#391d96' : 'var(--muted)',
        fontWeight: ativo ? 500 : 400, fontFamily: 'inherit', fontSize: 13,
        cursor: 'pointer', transition: 'all .15s var(--ease)',
      }}
    >
      {children}
    </button>
  )
}

// Horário digitado = horário de Brasília (fuso da clínica), não o do navegador.
const isoLocal = horarioBrasiliaParaISO

function formatarPreview(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: TZ,
  })
}
