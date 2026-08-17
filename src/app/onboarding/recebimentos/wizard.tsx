'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { salvarOnboardingAction } from './actions'
import type { OnboardingInput, CampoErro, TipoChavePix } from '@/server/services/onboardingPagamento'

/**
 * Wizard pós-cadastro (2 passos) — coleta dados do Recipient Pagar.me.
 * Bloqueio soft: páginas funcionam, mas ações de cobrança ficam desabilitadas
 * até `pgm_onboarding_em` ser preenchido (ver service).
 */

type Props = { nomePsicologa: string }

// Top bancos brasileiros (Pagar.me aceita todos com código FEBRABAN).
// Lista enxuta — se faltar algum, dá pra digitar manualmente.
const BANCOS: Array<{ codigo: string; nome: string }> = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica' },
  { codigo: '260', nome: 'Nubank' },
  { codigo: '077', nome: 'Inter' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '290', nome: 'PagBank' },
  { codigo: '380', nome: 'PicPay' },
]

type Step = 1 | 2 | 3
const TIPOS_PIX: Array<{ key: TipoChavePix; label: string; placeholder: string }> = [
  { key: 'cpf',       label: 'CPF',       placeholder: '000.000.000-00' },
  { key: 'cnpj',      label: 'CNPJ',      placeholder: '00.000.000/0000-00' },
  { key: 'email',     label: 'Email',     placeholder: 'voce@email.com' },
  { key: 'celular',   label: 'Celular',   placeholder: '(11) 98765-4321' },
  { key: 'aleatoria', label: 'Aleatória', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
]

export function Wizard({ nomePsicologa }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Passo 1
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>('PF')
  const [documento, setDocumento] = useState('')
  const [razaoSocial, setRazaoSocial] = useState(nomePsicologa)
  const [dataNascimento, setDataNascimento] = useState('')
  const [rendaReais, setRendaReais] = useState('')

  // Endereço — a Pagar.me recusa o recebedor sem ele (PF e PJ).
  const [endCep, setEndCep] = useState('')
  const [endLogradouro, setEndLogradouro] = useState('')
  const [endNumero, setEndNumero] = useState('')
  const [endComplemento, setEndComplemento] = useState('')
  const [endBairro, setEndBairro] = useState('')
  const [endCidade, setEndCidade] = useState('')
  const [endUf, setEndUf] = useState('')
  const [buscandoCep, setBuscandoCep] = useState(false)

  // Sócio administrador — obrigatório só para PJ (managing_partners).
  const [socioNome, setSocioNome] = useState('')
  const [socioCpf, setSocioCpf] = useState('')
  const [socioNascimento, setSocioNascimento] = useState('')
  const [socioEmail, setSocioEmail] = useState('')
  const [socioTelefone, setSocioTelefone] = useState('')
  const [socioRendaReais, setSocioRendaReais] = useState('')

  // Passo 2
  const [bancoCodigo, setBancoCodigo] = useState('')
  const [bancoAgencia, setBancoAgencia] = useState('')
  const [bancoAgenciaDv, setBancoAgenciaDv] = useState('')
  const [bancoConta, setBancoConta] = useState('')
  const [bancoContaDv, setBancoContaDv] = useState('')
  const [bancoTipo, setBancoTipo] = useState<'corrente' | 'poupanca'>('corrente')
  const [souTitular, setSouTitular] = useState(true)
  const [titularNome, setTitularNome] = useState(nomePsicologa)
  const [titularDocumento, setTitularDocumento] = useState('')

  // Passo 3 — chave PIX (opcional)
  const [usaChavePix, setUsaChavePix] = useState(false)
  const [chavePixTipo, setChavePixTipo] = useState<TipoChavePix>('cpf')
  const [chavePixValor, setChavePixValor] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<CampoErro | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Quando "sou titular" muda, sincroniza titular com dados do cadastro.
  useEffect(() => {
    if (souTitular) {
      setTitularNome(tipoPessoa === 'PF' ? nomePsicologa : razaoSocial)
      setTitularDocumento(documento)
    }
  }, [souTitular, tipoPessoa, nomePsicologa, razaoSocial, documento])

  function validarPasso1(): boolean {
    setErro(null); setErroCampo(null)
    const docDigits = documento.replace(/\D/g, '')
    if (tipoPessoa === 'PF' && docDigits.length !== 11) {
      setErro('CPF deve ter 11 dígitos.'); setErroCampo('documento'); return false
    }
    if (tipoPessoa === 'PJ' && docDigits.length !== 14) {
      setErro('CNPJ deve ter 14 dígitos.'); setErroCampo('documento'); return false
    }
    if (razaoSocial.trim().length < 3) {
      setErro(tipoPessoa === 'PF' ? 'Informe o nome civil.' : 'Informe a razão social.')
      setErroCampo('razaoSocial'); return false
    }
    if (!dataNascimento) {
      setErro(tipoPessoa === 'PF' ? 'Informe sua data de nascimento.' : 'Informe a data de fundação.')
      setErroCampo('dataNascimento'); return false
    }
    const renda = parseFloat(rendaReais.replace(',', '.'))
    if (!Number.isFinite(renda) || renda < 1000) {
      setErro('Informe um valor estimado (mínimo R$ 1.000).'); setErroCampo('rendaCentavos'); return false
    }
    // Endereço
    if (endCep.replace(/\D/g, '').length !== 8) { setErro('CEP deve ter 8 dígitos.'); setErroCampo('endCep'); return false }
    if (endLogradouro.trim().length < 3) { setErro('Informe o logradouro.'); setErroCampo('endLogradouro'); return false }
    if (!endNumero.trim()) { setErro('Informe o número (use S/N se não houver).'); setErroCampo('endNumero'); return false }
    if (endBairro.trim().length < 2) { setErro('Informe o bairro.'); setErroCampo('endBairro'); return false }
    if (endCidade.trim().length < 2) { setErro('Informe a cidade.'); setErroCampo('endCidade'); return false }
    if (!/^[A-Za-z]{2}$/.test(endUf.trim())) { setErro('UF deve ter 2 letras.'); setErroCampo('endUf'); return false }
    // Sócio (só PJ)
    if (tipoPessoa === 'PJ') {
      if (socioNome.trim().split(/\s+/).length < 2) { setErro('Informe o nome completo do sócio.'); setErroCampo('socioNome'); return false }
      if (socioCpf.replace(/\D/g, '').length !== 11) { setErro('CPF do sócio deve ter 11 dígitos.'); setErroCampo('socioCpf'); return false }
      if (!socioNascimento) { setErro('Informe a data de nascimento do sócio.'); setErroCampo('socioNascimento'); return false }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(socioEmail.trim())) { setErro('Email do sócio inválido.'); setErroCampo('socioEmail'); return false }
      if (socioTelefone.replace(/\D/g, '').length < 10) { setErro('Telefone do sócio inválido (com DDD).'); setErroCampo('socioTelefone'); return false }
    }
    return true
  }

  /** Preenche o endereço pelo CEP (ViaCEP) — poupa digitação e erro de bairro/UF. */
  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, '')
    if (cep.length !== 8) return
    setBuscandoCep(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const j = await r.json()
      if (!j?.erro) {
        if (j.logradouro) setEndLogradouro(j.logradouro)
        if (j.bairro) setEndBairro(j.bairro)
        if (j.localidade) setEndCidade(j.localidade)
        if (j.uf) setEndUf(j.uf)
      }
    } catch { /* offline ou CEP fora da base: usuário preenche à mão */ }
    finally { setBuscandoCep(false) }
  }

  function validarPasso2(): boolean {
    setErro(null); setErroCampo(null)
    if (!bancoCodigo) { setErro('Escolha o banco.'); setErroCampo('bancoCodigo'); return false }
    if (!bancoAgencia.replace(/\D/g, '')) { setErro('Agência obrigatória.'); setErroCampo('bancoAgencia'); return false }
    if (!bancoConta.replace(/\D/g, '')) { setErro('Conta obrigatória.'); setErroCampo('bancoConta'); return false }
    if (!bancoContaDv.replace(/\D/g, '')) { setErro('Dígito da conta obrigatório.'); setErroCampo('bancoContaDv'); return false }
    if (!souTitular) {
      if (titularNome.trim().length < 3) { setErro('Informe o titular.'); setErroCampo('titularNome'); return false }
      const d = titularDocumento.replace(/\D/g, '')
      if (d.length !== 11 && d.length !== 14) {
        setErro('CPF/CNPJ do titular inválido.'); setErroCampo('titularDocumento'); return false
      }
    }
    return true
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) {
      if (validarPasso1()) setStep(2)
      return
    }
    if (step === 2) {
      if (validarPasso2()) setStep(3)
      return
    }
    // step 3 — submit final (chave PIX opcional)
    setErro(null); setErroCampo(null); setEnviando(true)
    const input: OnboardingInput = {
      tipoPessoa,
      documento: documento.replace(/\D/g, ''),
      razaoSocial: razaoSocial.trim(),
      dataNascimento,
      rendaCentavos: Math.round(parseFloat(rendaReais.replace(',', '.')) * 100),
      endereco: {
        cep: endCep.replace(/\D/g, ''),
        logradouro: endLogradouro.trim(),
        numero: endNumero.trim(),
        complemento: endComplemento.trim() || null,
        bairro: endBairro.trim(),
        cidade: endCidade.trim(),
        uf: endUf.trim().toUpperCase(),
      },
      socio: tipoPessoa === 'PJ'
        ? {
            nome: socioNome.trim(),
            cpf: socioCpf.replace(/\D/g, ''),
            dataNascimento: socioNascimento,
            email: socioEmail.trim(),
            telefone: socioTelefone.replace(/\D/g, ''),
            // Sem campo próprio: a renda do sócio segue o faturamento informado.
            rendaMensalCentavos: Math.round(
              parseFloat((socioRendaReais || rendaReais).replace(',', '.')) * 100,
            ),
          }
        : null,
      banco: {
        codigo: bancoCodigo,
        agencia: bancoAgencia.replace(/\D/g, ''),
        agenciaDv: bancoAgenciaDv.replace(/\D/g, '') || null,
        conta: bancoConta.replace(/\D/g, ''),
        contaDv: bancoContaDv.replace(/\D/g, ''),
        tipo: bancoTipo,
        titularNome: titularNome.trim(),
        titularDocumento: titularDocumento.replace(/\D/g, ''),
      },
      chavePix: usaChavePix && chavePixValor.trim()
        ? { tipo: chavePixTipo, valor: chavePixValor.trim() }
        : null,
    }
    const r = await salvarOnboardingAction(input)
    setEnviando(false)
    if (r.ok) { router.push('/') ; router.refresh() }
    else { setErro(r.error); setErroCampo(r.campo ?? null) }
  }

  return (
    <div>
      <Stepper step={step} />

      <AvisoPagamentoBeta />

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 400, color: 'var(--ink)', margin: '4px 0 8px' }}>
        {step === 1 ? 'Configurar recebimentos' : step === 2 ? 'Conta bancária' : 'Chave PIX'}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0, marginBottom: 24, lineHeight: 1.55 }}>
        {step === 1 && 'Dados pra registrar você como recebedora no Pagar.me. O dinheiro das sessões cai direto na sua conta — Audere nunca toca o valor.'}
        {step === 2 && 'Conta de destino dos repasses. Pagamentos PIX caem em 1 dia útil, cartão em até 30 dias.'}
        {step === 3 && 'Opcional. Se preencher, sua chave PIX fica registrada como preferência de recebimento e será usada como destino padrão em estornos para pacientes que pagaram via PIX.'}
      </p>

      <form onSubmit={onSubmit} className="card" style={{ display: 'grid', gap: 16 }}>
        {step === 1 ? (
          <>
            <Field label="Tipo de cadastro" error={erroCampo === 'tipoPessoa' ? erro : undefined}>
              <div style={{ display: 'flex', gap: 8 }}>
                <PillBtn active={tipoPessoa === 'PF'} onClick={() => setTipoPessoa('PF')}>Pessoa física</PillBtn>
                <PillBtn active={tipoPessoa === 'PJ'} onClick={() => setTipoPessoa('PJ')}>Pessoa jurídica</PillBtn>
              </div>
            </Field>

            <Field
              label={tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
              error={erroCampo === 'documento' ? erro : undefined}
            >
              <input
                inputMode="numeric" required
                value={formatDoc(documento, tipoPessoa)}
                onChange={e => setDocumento(e.target.value.replace(/\D/g, '').slice(0, tipoPessoa === 'PF' ? 11 : 14))}
                placeholder={tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
              />
            </Field>

            <Field
              label={tipoPessoa === 'PF' ? 'Nome civil completo' : 'Razão social'}
              hint={tipoPessoa === 'PF' ? 'Exatamente como aparece no documento.' : undefined}
              error={erroCampo === 'razaoSocial' ? erro : undefined}
            >
              <input required value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field
                label={tipoPessoa === 'PF' ? 'Data de nascimento' : 'Data de fundação'}
                error={erroCampo === 'dataNascimento' ? erro : undefined}
              >
                <input
                  type="date" required value={dataNascimento}
                  onChange={e => setDataNascimento(e.target.value)}
                  style={{ minHeight: 46, fontSize: 16 }}
                />
              </Field>
              <Field
                label={tipoPessoa === 'PF' ? 'Renda mensal estimada (R$)' : 'Faturamento mensal (R$)'}
                hint="Exigido pra análise. Pode ser estimativa."
                error={erroCampo === 'rendaCentavos' ? erro : undefined}
              >
                <input
                  type="text" inputMode="decimal" required value={rendaReais}
                  onChange={e => setRendaReais(e.target.value.replace(/[^\d,.]/g, ''))}
                  placeholder="6000"
                />
              </Field>
            </div>

            {/* Endereço — a Pagar.me exige para registrar o recebedor. */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 2 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                {tipoPessoa === 'PF' ? 'Endereço residencial' : 'Endereço da sede'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12 }}>
                <Field label="CEP" error={erroCampo === 'endCep' ? erro : undefined}>
                  <input
                    inputMode="numeric" required value={formatCep(endCep)}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                      setEndCep(v)
                      if (v.length === 8) void buscarCep(v)
                    }}
                    placeholder="00000-000"
                  />
                </Field>
                <Field
                  label="Logradouro"
                  hint={buscandoCep ? 'buscando pelo CEP…' : undefined}
                  error={erroCampo === 'endLogradouro' ? erro : undefined}
                >
                  <input required value={endLogradouro} onChange={e => setEndLogradouro(e.target.value)} placeholder="Rua, avenida, quadra…" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginTop: 12 }}>
                <Field label="Número" error={erroCampo === 'endNumero' ? erro : undefined}>
                  <input required value={endNumero} onChange={e => setEndNumero(e.target.value)} placeholder="123 ou S/N" />
                </Field>
                <Field label="Complemento" hint="opcional">
                  <input value={endComplemento} onChange={e => setEndComplemento(e.target.value)} placeholder="Sala, apto…" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 12, marginTop: 12 }}>
                <Field label="Bairro" error={erroCampo === 'endBairro' ? erro : undefined}>
                  <input required value={endBairro} onChange={e => setEndBairro(e.target.value)} />
                </Field>
                <Field label="Cidade" error={erroCampo === 'endCidade' ? erro : undefined}>
                  <input required value={endCidade} onChange={e => setEndCidade(e.target.value)} />
                </Field>
                <Field label="UF" error={erroCampo === 'endUf' ? erro : undefined}>
                  <input
                    required value={endUf} maxLength={2}
                    onChange={e => setEndUf(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
                    placeholder="DF"
                  />
                </Field>
              </div>
            </div>

            {/* Sócio administrador — a Pagar.me exige ao menos um para PJ. */}
            {tipoPessoa === 'PJ' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Sócio administrador</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 10 }}>
                  Exigido pela análise cadastral da empresa. Usa o mesmo endereço da sede.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
                  <Field label="Nome completo" error={erroCampo === 'socioNome' ? erro : undefined}>
                    <input required value={socioNome} onChange={e => setSocioNome(e.target.value)} />
                  </Field>
                  <Field label="CPF" error={erroCampo === 'socioCpf' ? erro : undefined}>
                    <input
                      inputMode="numeric" required value={formatDoc(socioCpf, 'PF')}
                      onChange={e => setSocioCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="000.000.000-00"
                    />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <Field label="Data de nascimento" error={erroCampo === 'socioNascimento' ? erro : undefined}>
                    <input
                      type="date" required value={socioNascimento}
                      onChange={e => setSocioNascimento(e.target.value)}
                      style={{ minHeight: 46, fontSize: 16 }}
                    />
                  </Field>
                  <Field label="Telefone (com DDD)" error={erroCampo === 'socioTelefone' ? erro : undefined}>
                    <input
                      inputMode="numeric" required value={socioTelefone}
                      onChange={e => setSocioTelefone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="61999998888"
                    />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, marginTop: 12 }}>
                  <Field label="Email" error={erroCampo === 'socioEmail' ? erro : undefined}>
                    <input type="email" required value={socioEmail} onChange={e => setSocioEmail(e.target.value)} />
                  </Field>
                  <Field label="Renda mensal (R$)" hint="opcional">
                    <input
                      type="text" inputMode="decimal" value={socioRendaReais}
                      onChange={e => setSocioRendaReais(e.target.value.replace(/[^\d,.]/g, ''))}
                      placeholder={rendaReais || '6000'}
                    />
                  </Field>
                </div>
              </div>
            )}

            {erro && !erroCampo && <ErrorBanner>{erro}</ErrorBanner>}

            <Actions>
              <button type="submit" className="btn primary">Continuar →</button>
            </Actions>
          </>
        ) : step === 2 ? (
          <>
            <Field label="Banco" error={erroCampo === 'bancoCodigo' ? erro : undefined}>
              <select required value={bancoCodigo} onChange={e => setBancoCodigo(e.target.value)}>
                <option value="">Selecione…</option>
                {BANCOS.map(b => (
                  <option key={b.codigo} value={b.codigo}>{b.codigo} — {b.nome}</option>
                ))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="Agência" error={erroCampo === 'bancoAgencia' ? erro : undefined}>
                <input
                  inputMode="numeric" required value={bancoAgencia}
                  onChange={e => setBancoAgencia(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="0000"
                />
              </Field>
              <Field label="Dígito (opcional)">
                <input
                  inputMode="numeric" value={bancoAgenciaDv}
                  onChange={e => setBancoAgenciaDv(e.target.value.replace(/\D/g, '').slice(0, 1))}
                  placeholder="—"
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="Conta" error={erroCampo === 'bancoConta' ? erro : undefined}>
                <input
                  inputMode="numeric" required value={bancoConta}
                  onChange={e => setBancoConta(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="00000000"
                />
              </Field>
              <Field label="Dígito" error={erroCampo === 'bancoContaDv' ? erro : undefined}>
                <input
                  inputMode="numeric" required value={bancoContaDv}
                  onChange={e => setBancoContaDv(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Tipo de conta" error={erroCampo === 'bancoTipo' ? erro : undefined}>
              <div style={{ display: 'flex', gap: 8 }}>
                <PillBtn active={bancoTipo === 'corrente'} onClick={() => setBancoTipo('corrente')}>Corrente</PillBtn>
                <PillBtn active={bancoTipo === 'poupanca'} onClick={() => setBancoTipo('poupanca')}>Poupança</PillBtn>
              </div>
            </Field>

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox" checked={souTitular} onChange={e => setSouTitular(e.target.checked)}
                style={{ marginTop: 0 }}
              />
              <span>Sou a titular da conta</span>
            </label>

            {!souTitular && (
              <>
                <Field label="Nome do titular" error={erroCampo === 'titularNome' ? erro : undefined}>
                  <input required value={titularNome} onChange={e => setTitularNome(e.target.value)} />
                </Field>
                <Field label="CPF ou CNPJ do titular" error={erroCampo === 'titularDocumento' ? erro : undefined}>
                  <input
                    inputMode="numeric" required value={titularDocumento}
                    onChange={e => setTitularDocumento(e.target.value.replace(/\D/g, '').slice(0, 14))}
                    placeholder="Só dígitos"
                  />
                </Field>
              </>
            )}

            {erro && !erroCampo && <ErrorBanner>{erro}</ErrorBanner>}

            <Actions>
              <button type="button" className="btn ghost" onClick={() => setStep(1)}>← Voltar</button>
              <button type="submit" className="btn primary">Continuar →</button>
            </Actions>
          </>
        ) : (
          <>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--ink-soft)', cursor: 'pointer', lineHeight: 1.55 }}>
              <input
                type="checkbox" checked={usaChavePix} onChange={e => setUsaChavePix(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>Tenho uma chave PIX preferida para recebimento</span>
            </label>

            {usaChavePix && (
              <>
                <Field label="Tipo de chave" error={erroCampo === 'chavePixTipo' ? erro : undefined}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {TIPOS_PIX.map(t => (
                      <PillBtn
                        key={t.key}
                        active={chavePixTipo === t.key}
                        onClick={() => { setChavePixTipo(t.key); setChavePixValor('') }}
                      >
                        {t.label}
                      </PillBtn>
                    ))}
                  </div>
                </Field>

                <Field label="Chave PIX" error={erroCampo === 'chavePixValor' ? erro : undefined}>
                  <input
                    required value={chavePixValor}
                    onChange={e => setChavePixValor(e.target.value)}
                    placeholder={TIPOS_PIX.find(t => t.key === chavePixTipo)?.placeholder}
                    inputMode={chavePixTipo === 'email' ? 'email' : chavePixTipo === 'aleatoria' ? 'text' : 'numeric'}
                    autoComplete="off"
                  />
                </Field>
              </>
            )}

            {!usaChavePix && (
              <div style={{
                padding: '12px 14px', borderRadius: 8,
                background: 'var(--surface)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.55,
              }}>
                Sem chave PIX cadastrada, os repasses continuam via TED na conta bancária do passo anterior. Você pode adicionar depois no Perfil.
              </div>
            )}

            {erro && !erroCampo && <ErrorBanner>{erro}</ErrorBanner>}

            <Actions>
              <button type="button" className="btn ghost" onClick={() => setStep(2)}>← Voltar</button>
              <button type="submit" className="btn primary" disabled={enviando}>
                {enviando ? 'Cadastrando…' : 'Concluir cadastro'}
              </button>
            </Actions>
          </>
        )}

        <style jsx>{`
          input, select {
            width: 100%; padding: 9px 12px; border-radius: var(--field-radius);
            border: 1px solid var(--field-border); background: var(--field-bg);
            font-size: 13px; font-family: inherit; color: var(--ink); outline: none;
            transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
          }
          input:not([type=checkbox]):hover, select:hover { border-color: var(--field-border-hover); }
          input:not([type=checkbox]):focus, select:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
          input:not([type=checkbox]):user-invalid, select:user-invalid { border-color: var(--rose); }
          input:not([type=checkbox]):user-invalid:focus, select:user-invalid:focus { box-shadow: var(--field-ring-error); }
          input[type=checkbox] { width: auto; padding: 0; }
        `}</style>
      </form>

      <p style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
        Seus dados ficam criptografados em repouso. CPF/CNPJ usados apenas pra registro no Pagar.me.
      </p>
    </div>
  )
}

/** Aviso de beta: a cobrança automática via WhatsApp ainda não está ativa.
 * O psicólogo pode deixar os dados de recebimento prontos desde já. */
function AvisoPagamentoBeta() {
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 11,
        padding: '13px 15px', borderRadius: 12, marginBottom: 20,
        background: 'rgba(176,125,64,.08)', border: '1px solid rgba(176,125,64,.22)',
      }}
    >
      <span aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
        <Clock size={16} color="#b07d40" />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#7a5520', marginBottom: 2 }}>
          Cobrança pelo WhatsApp em ativação
        </div>
        <div style={{ fontSize: 12, color: '#9a7030', lineHeight: 1.55 }}>
          O envio automático de cobranças (PIX e cartão) pelo WhatsApp ainda
          está sendo liberado durante o beta. Você já pode <strong>deixar seus
          dados de recebimento prontos</strong> aqui — assim que ativarmos, a
          cobrança funciona sem nenhum passo extra. Por enquanto, combine o
          pagamento com seus pacientes da forma habitual.
        </div>
      </div>
    </div>
  )
}

function Stepper({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 20, fontSize: 11, color: 'var(--muted)' }}>
      <Dot active={step >= 1} done={step > 1} /> Dados <span style={{ opacity: .4 }}>→</span>
      <Dot active={step >= 2} done={step > 2} /> Conta bancária <span style={{ opacity: .4 }}>→</span>
      <Dot active={step >= 3} done={false} /> Chave PIX <span style={{ opacity: .5, fontSize: 10, marginLeft: 2 }}>(opcional)</span>
    </div>
  )
}
function Dot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <span style={{
      width: 16, height: 16, borderRadius: '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: done ? 'var(--sage)' : active ? 'var(--accent)' : 'var(--surface)',
      color: 'white', fontSize: 10, fontWeight: 600,
      border: active || done ? 'none' : '1px solid var(--border)',
    }}>
      {done ? '✓' : ''}
    </span>
  )
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

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        flex: 1, padding: '9px 12px', borderRadius: 999,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(106,78,200,.10)' : 'transparent',
        color: active ? '#391d96' : 'var(--muted)',
        fontWeight: active ? 500 : 400, fontFamily: 'inherit', fontSize: 13,
        cursor: 'pointer', transition: 'all .15s var(--ease)',
      }}
    >
      {children}
    </button>
  )
}

function Actions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
      {children}
    </div>
  )
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(196,96,122,.08)', color: 'var(--rose)',
      fontSize: 12, lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5, 8)}`
}

function formatDoc(raw: string, tipo: 'PF' | 'PJ'): string {
  const d = raw.replace(/\D/g, '')
  if (tipo === 'PF') {
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`
  }
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`
}
