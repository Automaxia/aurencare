'use client'

import { useState } from 'react'
import { salvarPerfilAction, type SalvarInput } from './actions'

type InitialPerfil = {
  nome: string
  crp: string
  email: string
  valorSessao: number | null
  waInstancia: string | null
}

type Props = {
  initial: InitialPerfil
  emailAtual: string
  integrationStatus: { anthropic: boolean; evolution: boolean; pagarme: boolean; assembly: boolean }
}

export function PerfilForm({ initial, emailAtual, integrationStatus }: Props) {
  const [nome, setNome] = useState(initial.nome)
  const [crp, setCrp] = useState(initial.crp)
  const [email, setEmail] = useState(initial.email)
  const [valorSessao, setValor] = useState<string>(initial.valorSessao !== null ? String(initial.valorSessao) : '')
  const [waInstancia, setWaInst] = useState(initial.waInstancia ?? '')
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null); setErroCampo(null); setSalvo(false)
    const input: SalvarInput = {
      nome, crp, email,
      valorSessao: valorSessao === '' ? null : parseFloat(valorSessao.replace(',', '.')),
      waInstancia: waInstancia.trim() || null,
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
        <div className="sec-lbl">Dados profissionais</div>

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

        <div className="sec-lbl" style={{ marginTop: 8 }}>Integração WhatsApp</div>
        <Field label="Nome da instância Evolution" hint="o nome configurado no painel da Evolution API">
          <input value={waInstancia} onChange={e => setWaInst(e.target.value)} placeholder="auren-care" />
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="submit" className="btn primary" disabled={salvando}>
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
          <div className="sec-lbl" style={{ marginBottom: 10 }}>Integrações ativas</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <Integ label="Anthropic (IA)" on={integrationStatus.anthropic} hint="apoia chat, observações, validação de termos" />
            <Integ label="Evolution (WhatsApp)" on={integrationStatus.evolution} hint="envio e recebimento real de mensagens" />
            <Integ label="Pagar.me" on={integrationStatus.pagarme} hint="PIX e cartão" />
            <Integ label="AssemblyAI (transcrição)" on={integrationStatus.assembly} hint="transcrição streaming (fallback nativo do navegador)" />
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, lineHeight: 1.55 }}>
            Para ativar uma integração desligada, preencha a chave correspondente em <code style={{ background: 'var(--surface)', padding: '1px 5px', borderRadius: 4 }}>.env.local</code> e reinicie o servidor.
          </p>
        </div>
        <div className="card" style={{ background: 'var(--surface)' }}>
          <div className="sec-lbl" style={{ marginBottom: 8 }}>Segurança</div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
            Todas as transcrições, notas e resumos são criptografados em repouso (AES-256-GCM).
            Trocar email ou senha exige confirmação da senha atual.
          </p>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--faint)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: 'var(--rose)' }}>{error}</span>}
    </label>
  )
}

function Integ({ label, on, hint }: { label: string; on: boolean; hint: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', marginTop: 6,
        background: on ? 'var(--sage)' : 'var(--faint)', flexShrink: 0,
        boxShadow: on ? '0 0 6px rgba(90,158,138,.5)' : undefined,
      }} />
      <div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{label}
          <span style={{ fontSize: 10, color: on ? 'var(--sage)' : 'var(--faint)', marginLeft: 6, textTransform: 'uppercase', letterSpacing: '.6px' }}>
            {on ? 'ativa' : 'desligada'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{hint}</div>
      </div>
    </div>
  )
}
