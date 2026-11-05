import { Logo } from '@/components/brand/Logo'

/**
 * Destino do `success_url` do checkout de cartão (Pagar.me). Antes apontava para
 * uma rota inexistente (sdd §1, defeito 5) — o paciente pagava e caía num 404.
 *
 * Pública (middleware) e sem dado nenhum: quem confirma a sessão é o webhook,
 * não esta página. Ela só tranquiliza o paciente.
 */
export default function PagamentoOkPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <Logo size={28} />
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '48px 20px' }}>
        <div style={{ width: '100%', maxWidth: 460, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 24px' }}>
          <h1 style={{ fontFamily: 'var(--font-display, "Cormorant Garamond", serif)', fontWeight: 400, fontSize: 28, margin: 0, color: 'var(--ink)' }}>
            Pagamento recebido
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)', marginTop: 12 }}>
            Obrigado! Assim que a confirmação chegar, você recebe uma mensagem no
            WhatsApp com os detalhes da sua sessão. Pode fechar esta página.
          </p>
        </div>
      </main>
    </div>
  )
}
