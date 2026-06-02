import { PageHeader, EmptyState } from '@/components/PageHeader'
import { requirePsicologo } from '@/server/lib/auth'
import { lerOnboardingDetalhes } from '@/server/services/onboardingPagamento'
import { lerPerfilTributario } from '@/server/services/perfilTributario'
import Link from 'next/link'
import { ChavePixForm } from './form'
import { TributarioForm } from './TributarioForm'

export const dynamic = 'force-dynamic'

const BANCOS_NOME: Record<string, string> = {
  '001': 'Banco do Brasil', '237': 'Bradesco', '341': 'Itaú', '033': 'Santander',
  '104': 'Caixa Econômica', '260': 'Nubank', '077': 'Inter', '336': 'C6 Bank',
  '756': 'Sicoob', '748': 'Sicredi', '208': 'BTG Pactual', '212': 'Banco Original',
  '290': 'PagBank', '380': 'PicPay',
}

export default async function PerfilRecebimentosPage() {
  const user = await requirePsicologo()
  const [d, tributario] = await Promise.all([
    lerOnboardingDetalhes(user.id),
    lerPerfilTributario(user.id),
  ])

  if (!d.completo) {
    return (
      <div>
        <PerfilTabs active="recebimentos" />
        <PageHeader title="Recebimentos" subtitle="Conta bancária e chave PIX." />
        <EmptyState>
          Você ainda não configurou seus dados de recebimento.{' '}
          <Link href="/onboarding/recebimentos" style={{ color: 'var(--accent)' }}>Completar agora →</Link>
        </EmptyState>
      </div>
    )
  }

  return (
    <div>
      <PerfilTabs active="recebimentos" />
      <PageHeader title="Recebimentos" subtitle="Conta bancária e chave PIX." />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Conta bancária — read-only */}
          <div className="card">
            <div className="sec-lbl" style={{ marginBottom: 12 }}>Conta bancária para repasse</div>
            <ReadField label="Banco" value={d.banco.codigo ? `${d.banco.codigo} — ${BANCOS_NOME[d.banco.codigo] ?? '—'}` : '—'} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
              <ReadField label="Agência" value={d.banco.agencia ?? '—'} />
              <ReadField label="Conta" value={d.banco.contaMasc ?? '—'} />
              <ReadField label="Tipo" value={d.banco.tipo === 'corrente' ? 'Corrente' : d.banco.tipo === 'poupanca' ? 'Poupança' : '—'} />
            </div>
            <ReadField label="Titular" value={d.banco.titularNome ?? '—'} style={{ marginTop: 10 }} />
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(176,125,64,.08)', fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.55,
            }}>
              Alterações na conta bancária exigem reanálise da Pagar.me.{' '}
              <strong>Fale com o suporte</strong> pra atualizar.
            </div>
          </div>

          {/* Chave PIX — editável */}
          <ChavePixForm chaveAtual={d.chavePix} />

          {/* Perfil tributário — pra cálculo de impostos e exportações pro contador */}
          <TributarioForm inicial={tributario} />
        </div>

        {/* Sidebar — dados pessoais (read-only resumido) */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="sec-lbl" style={{ marginBottom: 12 }}>Dados cadastrados</div>
            <ReadField label="Tipo" value={d.tipoPessoa === 'PF' ? 'Pessoa física' : d.tipoPessoa === 'PJ' ? 'Pessoa jurídica' : '—'} />
            <ReadField label={d.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'} value={d.documentoMasc ?? '—'} style={{ marginTop: 10 }} />
            <ReadField label={d.tipoPessoa === 'PF' ? 'Nome civil' : 'Razão social'} value={d.razaoSocial ?? '—'} style={{ marginTop: 10 }} />
            <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 14, lineHeight: 1.55 }}>
              Documento e dados pessoais ficam criptografados. Pra alterar, contate o suporte.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function PerfilTabs({ active }: { active: 'perfil' | 'recebimentos' }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      <TabLink href="/perfil"              label="Perfil"       active={active === 'perfil'} />
      <TabLink href="/perfil/recebimentos" label="Recebimentos" active={active === 'recebimentos'} />
    </div>
  )
}
function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: '7px 14px', borderRadius: 999, fontSize: 12,
        background: active ? 'rgba(106,78,200,.10)' : 'transparent',
        color: active ? '#391d96' : 'var(--muted)',
        fontWeight: active ? 500 : 400,
        textDecoration: 'none', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        transition: 'all .15s var(--ease)',
      }}
    >
      {label}
    </Link>
  )
}
function ReadField({ label, value, style }: { label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-mono), monospace' }}>{value}</div>
    </div>
  )
}
