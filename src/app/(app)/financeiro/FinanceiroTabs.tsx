import Link from 'next/link'

/** Nav de tabs entre o painel de cobranças e a visão contábil. */
export function FinanceiroTabs({ ativo }: { ativo: 'cobrancas' | 'contabil' }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      <Tab href="/financeiro"          label="Cobranças"        ativo={ativo === 'cobrancas'} />
      <Tab href="/financeiro/contabil" label="Visão contábil"   ativo={ativo === 'contabil'} />
    </div>
  )
}

function Tab({ href, label, ativo }: { href: string; label: string; ativo: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: '7px 14px', borderRadius: 999, fontSize: 12,
        background: ativo ? 'rgba(106,78,200,.10)' : 'transparent',
        color: ativo ? '#391d96' : 'var(--muted)',
        fontWeight: ativo ? 500 : 400,
        textDecoration: 'none',
        border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`,
        transition: 'all .15s var(--ease)',
      }}
    >
      {label}
    </Link>
  )
}
