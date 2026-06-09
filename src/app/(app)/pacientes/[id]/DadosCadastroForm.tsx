'use client'

import { useState } from 'react'
import { salvarDadosCadastroAction } from './actions'
import { SavedBadge } from '@/components/brand/Feedback'
import type { DadosCadastro, ContatoEmergencia } from '@/server/services/pacientes'

const RACA_COR = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Prefiro não informar']
const GENERO = ['Mulher cis', 'Homem cis', 'Mulher trans', 'Homem trans', 'Travesti', 'Não-binário', 'Outro', 'Prefiro não informar']
const ESTADO_CIVIL = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)', 'Separado(a)']
const ORIGEM = ['Indicação', 'Google', 'Instagram', 'Doctoralia', 'Convênio', 'Site próprio', 'Outro']

export function DadosCadastroForm({ pacienteId, initial }: { pacienteId: string; initial: DadosCadastro }) {
  const [d, setD] = useState<DadosCadastro>(initial ?? {})
  const [contatos, setContatos] = useState<ContatoEmergencia[]>(initial?.contatosEmergencia ?? [])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<DadosCadastro>) => setD(prev => ({ ...prev, ...patch }))
  const setContato = (i: number, patch: Partial<ContatoEmergencia>) =>
    setContatos(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  async function salvar() {
    setLoading(true); setError(null); setSaved(false)
    try {
      const r = await salvarDadosCadastroAction(pacienteId, { ...d, contatosEmergencia: contatos })
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
      else setError('Falha ao salvar.')
    } catch {
      setError('Falha ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 14, maxWidth: 720 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        Dados cadastrais <span style={{ textTransform: 'none', color: 'var(--faint)' }}>· todos opcionais</span>
      </div>

      <div className="dc-grid">
        <Campo label="Nome social"><input value={d.nomeSocial ?? ''} onChange={e => set({ nomeSocial: e.target.value })} placeholder="Como prefere ser chamado(a)" /></Campo>
        <Campo label="CPF"><input value={d.cpf ?? ''} onChange={e => set({ cpf: e.target.value })} inputMode="numeric" placeholder="000.000.000-00" /></Campo>

        <Campo label="País"><input value={d.pais ?? ''} onChange={e => set({ pais: e.target.value })} placeholder="Brasil" /></Campo>
        <Campo label="Estado"><input value={d.estado ?? ''} onChange={e => set({ estado: e.target.value })} placeholder="SP" /></Campo>
        <Campo label="Cidade"><input value={d.cidade ?? ''} onChange={e => set({ cidade: e.target.value })} placeholder="São Paulo" /></Campo>

        <Campo label="Raça/cor"><ListaInput value={d.racaCor ?? ''} onChange={v => set({ racaCor: v })} opcoes={RACA_COR} id="raca" /></Campo>
        <Campo label="Gênero"><ListaInput value={d.genero ?? ''} onChange={v => set({ genero: v })} opcoes={GENERO} id="genero" /></Campo>
        <Campo label="Estado civil"><ListaInput value={d.estadoCivil ?? ''} onChange={v => set({ estadoCivil: v })} opcoes={ESTADO_CIVIL} id="ecivil" /></Campo>

        <Campo label="Ocupação"><input value={d.ocupacao ?? ''} onChange={e => set({ ocupacao: e.target.value })} placeholder="Profissão / atividade" /></Campo>
        <Campo label="Formação"><input value={d.formacao ?? ''} onChange={e => set({ formacao: e.target.value })} placeholder="Escolaridade / formação" /></Campo>
        <Campo label="Origem (como chegou)"><ListaInput value={d.origem ?? ''} onChange={v => set({ origem: v })} opcoes={ORIGEM} id="origem" /></Campo>
      </div>

      {/* Contatos de emergência (vários) */}
      <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Contatos de emergência</div>
        {contatos.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--faint)' }}>Nenhum contato — adicione abaixo.</div>
        )}
        {contatos.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <input value={c.nome ?? ''} onChange={e => setContato(i, { nome: e.target.value })} placeholder="Nome" />
            <input value={c.telefone ?? ''} onChange={e => setContato(i, { telefone: e.target.value })} placeholder="Telefone" inputMode="tel" />
            <input value={c.email ?? ''} onChange={e => setContato(i, { email: e.target.value })} placeholder="E-mail" inputMode="email" />
            <button type="button" className="btn ghost sm" onClick={() => setContatos(prev => prev.filter((_, idx) => idx !== i))} title="Remover">✕</button>
          </div>
        ))}
        <button type="button" className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => setContatos(prev => [...prev, {}])}>
          + Adicionar contato
        </button>
      </div>

      {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}
      {saved && <SavedBadge />}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={salvar} disabled={loading}>
          {loading ? 'Salvando…' : 'Salvar dados cadastrais'}
        </button>
      </div>

      <style jsx>{`
        .dc-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        @media (max-width: 720px) { .dc-grid { grid-template-columns: 1fr 1fr; } }
        input {
          width: 100%; padding: 8px 12px; border-radius: var(--field-radius);
          border: 1px solid var(--field-border); background: var(--field-bg);
          font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
          transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
        }
        input:hover { border-color: var(--field-border-hover); }
        input:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
        input:user-invalid { border-color: var(--rose); }
        input:user-invalid:focus { box-shadow: var(--field-ring-error); }
      `}</style>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
      {children}
    </label>
  )
}

/** Input com sugestões (datalist) — não restringe, aceita texto livre. */
function ListaInput({ value, onChange, opcoes, id }: { value: string; onChange: (v: string) => void; opcoes: string[]; id: string }) {
  return (
    <>
      <input list={`dl-${id}`} value={value} onChange={e => onChange(e.target.value)} placeholder="Selecione ou digite" />
      <datalist id={`dl-${id}`}>
        {opcoes.map(o => <option key={o} value={o} />)}
      </datalist>
    </>
  )
}
