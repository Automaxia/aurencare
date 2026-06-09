'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarSessaoAction, criarSerieAction, conflitosSerieAction } from './actions'

type Modo = 'avulsa' | 'serie'
type Frequencia = 'semanal' | 'quinzenal'

const SEMANAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function NewSessionForm({ pacientes }: { pacientes: { id: string; nome: string }[] }) {
  const router = useRouter()
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
    // Busca conflitos no backend
    conflitosSerieAction(datas).then(c => setConflitos(new Set(c))).catch(() => {})
  }, [modo, data, hora, frequencia, quantidade])

  const diaSemana = (() => {
    const iso = isoLocal(data, hora); if (!iso) return ''
    return SEMANAS_PT[new Date(iso).getDay()]
  })()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const iso = isoLocal(data, hora)
    if (!iso) { setError('Data/hora inválida.'); setLoading(false); return }

    if (modo === 'avulsa') {
      const r = await criarSessaoAction({ pacienteId, dataHora: iso, duracaoMin: duracao, modalidade, valor })
      setLoading(false)
      if (r.ok) router.push('/agenda')
      else setError(r.error)
    } else {
      const r = await criarSerieAction({
        pacienteId, primeiraSessaoIso: iso, frequencia, quantidade,
        duracaoMin: duracao, modalidade, valor,
      })
      setLoading(false)
      if (r.ok) router.push('/agenda')
      else setError(r.error)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 14, maxWidth: 560 }}>
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
        <Field label={modo === 'serie' ? 'Valor por sessão (R$)' : 'Valor (R$)'}>
          <input
            type="number" value={gratuita ? 0 : valor}
            onChange={e => setValor(+e.target.value)}
            min={0} step={10} disabled={gratuita}
            style={gratuita ? { opacity: .5 } : undefined}
          />
        </Field>
      </div>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer' }}>
        <input
          type="checkbox" checked={gratuita}
          onChange={e => { setGratuita(e.target.checked); if (e.target.checked) setValor(0) }}
        />
        Não cobrar esta sessão (gratuita) — sem pedido de pagamento ao paciente
      </label>

      {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        {modo === 'serie' && datasPreview.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 'auto' }}>
            Total: R$ {(valor * datasPreview.length).toFixed(2)}
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
        input, select {
          width: 100%; padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--border); background: white;
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
        }
        input:focus, select:focus { border-color: var(--accent); }
      `}</style>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
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

function isoLocal(data: string, hora: string): string | null {
  if (!data || !hora) return null
  const dt = new Date(`${data}T${hora}:00`)
  if (Number.isNaN(+dt)) return null
  return dt.toISOString()
}

function formatarPreview(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  })
}
