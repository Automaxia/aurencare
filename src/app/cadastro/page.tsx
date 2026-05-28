import { Logo } from '@/components/brand/Logo'
import { CfpBadge } from '@/components/brand/CfpBadge'
import Link from 'next/link'
import { CadastroForm } from './form'

export const dynamic = 'force-dynamic'

export default function CadastroPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24,
      background: 'linear-gradient(180deg, var(--page) 0%, var(--surface) 100%)',
    }}>
      <div className="card" style={{ maxWidth: 460, width: '100%', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size={36} layout="stack" tagline />
        </div>

        <h2 style={{ textAlign: 'center', margin: '6px 0 4px' }}>Criar sua conta</h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 0, marginBottom: 20 }}>
          5 campos. O resto a gente configura por você.
        </p>

        <CadastroForm />

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          Já tem conta? <Link href="/login" style={{ color: 'var(--accent)' }}>Entrar</Link>
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          <CfpBadge />
        </div>
      </div>
    </div>
  )
}
