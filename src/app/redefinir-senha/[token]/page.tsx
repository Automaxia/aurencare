import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { tokenResetValido } from '@/server/services/recuperacaoSenha'
import { RedefinirForm } from './RedefinirForm'

export const dynamic = 'force-dynamic'

export default async function RedefinirSenhaPage({ params }: { params: { token: string } }) {
  const valido = await tokenResetValido(params.token)

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      backgroundColor: 'var(--page)',
      backgroundImage: 'url(/landing/login-bg.webp)',
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
    }}>
      <div className="card" style={{ width: 'min(360px, 92vw)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logo size={40} layout="stack" tagline />
        </div>

        {valido ? (
          <RedefinirForm token={params.token} />
        ) : (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Link expirado</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', lineHeight: 1.6 }}>
              Este link de recuperação expirou ou já foi usado. Os links valem por 1 hora.
            </p>
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <Link href="/recuperar-senha" className="btn primary" style={{ justifyContent: 'center', display: 'inline-flex' }}>
                Pedir um novo link
              </Link>
            </div>
          </>
        )}

        <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          <Link href="/login" style={{ color: 'var(--accent)' }}>← Voltar para entrar</Link>
        </div>
      </div>
    </div>
  )
}
