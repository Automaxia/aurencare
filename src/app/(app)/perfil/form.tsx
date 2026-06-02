'use client'

import { useMemo, useState } from 'react'
import { salvarPerfilAction, type SalvarInput } from './actions'

type InitialPerfil = {
  nome: string
  crp: string
  email: string
  telefone: string
  valorSessao: number | null
}

type Props = {
  initial: InitialPerfil
  emailAtual: string
  waConectado: boolean
}

export function PerfilForm({ initial, emailAtual, waConectado }: Props) {
  const [nome, setNome] = useState(initial.nome)
  const [crp, setCrp] = useState(initial.crp)
  const [email, setEmail] = useState(initial.email)
  const [telefone, setTelefone] = useState(initial.telefone)
  const [valorSessao, setValor] = useState<string>(initial.valorSessao !== null ? String(initial.valorSessao) : '')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarNovaSenha, setConfirmar] = useState('')
  const [senhaAtual, setSenhaAtual] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const trocandoSenha = novaSenha.length > 0
  const trocandoEmail = email.toLowerCase().trim() !== emailAtual.toLowerCase().trim()
  const exigeSenhaAtual = trocandoSenha || trocandoEmail

  // ── dirty state: habilita Salvar só quando há mudança real ──
  const dirty = useMemo(() => {
    const valorAtual = valorSessao === '' ? null : parseFloat(valorSessao.replace(',', '.'))
    const telAtual = telefone.replace(/\D/g, '')
    const telInit  = initial.telefone.replace(/\D/g, '')
    return (
      nome.trim() !== initial.nome ||
      crp.trim() !== initial.crp ||
      trocandoEmail ||
      telAtual !== telInit ||
      valorAtual !== initial.valorSessao ||
      trocandoSenha
    )
  }, [nome, crp, email, telefone, valorSessao, novaSenha, initial, trocandoEmail, trocandoSenha])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null); setErroCampo(null); setSalvo(false)
    const input: SalvarInput = {
      nome, crp, email, telefone,
      valorSessao: valorSessao === '' ? null : parseFloat(valorSessao.replace(',', '.')),
      novaSenha, confirmarNovaSenha, senhaAtual,
    }
    const r = await salvarPerfilAction(input)
    setSalvando(false)
    if (r.ok) {
      setSalvo(true)
      setNovaSenha(''); setConfirmar(''); setSenhaAtual('')
      setTimeout(() => setSalvo(false), 3000)
    } else {
      setErro(r.error)
      setErroCampo(r.campo ?? null)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
      <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 14 }}>
        <div className="sec-lbl">Dados básicos</div>

        <Field label="Nome completo" error={erroCampo === 'nome' ? erro : undefined}>
          <input required value={nome} onChange={e => setNome(e.target.value)} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="CRP" error={erroCampo === 'crp' ? erro : undefined}>
            <input required value={crp} onChange={e => setCrp(e.target.value)} placeholder="CRP 06/12345" />
          </Field>
          <Field label="Valor da sessão (R$)" error={erroCampo === 'valorSessao' ? erro : undefined}>
            <input
              type="number" min={0} step={10} value={valorSessao}
              onChange={e => setValor(e.target.value)}
              placeholder="220"
            />
          </Field>
        </div>

        <Field
          label={`Email${trocandoEmail ? ' — exige senha atual' : ''}`}
          error={erroCampo === 'email' ? erro : undefined}
        >
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </Field>

        <Field
          label="Telefone WhatsApp"
          hint="Número da prática. É por ele que pacientes mandam mensagem e marcam sessão."
          error={erroCampo === 'telefone' ? erro : undefined}
        >
          <input
            type="tel" value={telefone}
            onChange={e => setTelefone(e.target.value.replace(/[^\d() -]/g, ''))}
            placeholder="(11) 98765-4321"
            inputMode="tel"
          />
        </Field>

        <div className="sec-lbl" style={{ marginTop: 8 }}>Alterar senha (opcional)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nova senha" error={erroCampo === 'novaSenha' ? erro : undefined}>
            <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="mínimo 8 caracteres" />
          </Field>
          <Field label="Confirmar nova senha" error={erroCampo === 'confirmarNovaSenha' ? erro : undefined}>
            <input type="password" value={confirmarNovaSenha} onChange={e => setConfirmar(e.target.value)} />
          </Field>
        </div>

        {exigeSenhaAtual && (
          <Field
            label={`Senha atual${trocandoEmail && trocandoSenha ? ' — exigida pra mudar email e senha' : trocandoEmail ? ' — exigida pra mudar email' : ' — exigida pra mudar senha'}`}
            error={erroCampo === 'senhaAtual' ? erro : undefined}
          >
            <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} required />
          </Field>
        )}

        {erro && !erroCampo && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{erro}</div>}
        {salvo && <div style={{ color: 'var(--sage)', fontSize: 13 }}>✓ Alterações salvas</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>
            {dirty ? 'Você tem alterações não salvas' : 'Nenhuma alteração pendente'}
          </span>
          <button
            type="submit"
            className={dirty ? 'btn primary' : 'btn'}
            disabled={salvando || !dirty}
            title={!dirty ? 'Nada para salvar' : undefined}
          >
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

        <style jsx>{`
          input {
            width: 100%; padding: 8px 12px; border-radius: 8px;
            border: 1px solid var(--border); background: white;
            font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
          }
          input:focus { border-color: var(--accent); }
        `}</style>
      </form>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card">
          <div className="sec-lbl" style={{ marginBottom: 10 }}>WhatsApp da prática</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: waConectado ? 'var(--sage)' : 'var(--amber)',
              boxShadow: waConectado ? '0 0 6px rgba(90,158,138,.5)' : undefined,
            }} />
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>
                {waConectado ? 'Conectado' : 'Configuração em andamento'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {telefone
                  ? `Pacientes te mandam mensagem em ${formatPhone(telefone)}.`
                  : 'Adicione um telefone WhatsApp ao lado pra ativar.'}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 14, lineHeight: 1.55 }}>
            A conexão técnica é gerenciada pelo Auren. Se tiver problemas, fale com o suporte.
          </p>
        </div>

        <div className="card" style={{ background: 'var(--surface)' }}>
          <div className="sec-lbl" style={{ marginBottom: 8 }}>Segurança</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            Todas as transcrições, notas e resumos ficam criptografados.
            Trocar email ou senha exige confirmação da senha atual.
          </p>
        </div>
      </aside>
    </div>
  )
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--faint)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{error}</span>}
    </label>
  )
}
