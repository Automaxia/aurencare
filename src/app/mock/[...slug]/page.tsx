/**
 * Página de cobrança SIMULADA.
 *
 * Sem `PAGARME_API_KEY` configurada, `criarOrderPix`/`criarCheckoutCartao` caem
 * em modo mock e devolvem URLs `/mock/qr/<id>.png` e `/mock/checkout/<id>` —
 * que eram enviadas ao paciente por WhatsApp e davam **404**. Esta rota existe
 * para que o link ao menos explique o que aconteceu, em vez de parecer um site
 * quebrado. Cobre os dois caminhos (`qr` e `checkout`) num catch-all.
 *
 * Em produção com chave real esta página nunca é alcançada.
 */
export const dynamic = 'force-dynamic'

export default function MockCobrancaPage({ params }: { params: { slug?: string[] } }) {
  const tipo = params.slug?.[0] === 'qr' ? 'PIX' : 'cartão'

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--page, #f9f8f5)',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          textAlign: 'center',
          background: 'var(--card, #fff)',
          border: '1px solid rgba(26,24,37,.055)',
          borderRadius: 16,
          padding: '32px 28px',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>

        <h1
          style={{
            fontFamily: 'var(--font-display, Georgia, serif)',
            fontSize: 24,
            fontWeight: 400,
            color: 'var(--ink, #1a1825)',
            margin: '0 0 10px',
          }}
        >
          Cobrança de demonstração
        </h1>

        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft, #38324e)', margin: '0 0 16px' }}>
          Esta seria a tela de pagamento por <strong>{tipo}</strong>, mas o ambiente
          está em modo de demonstração — nenhum valor foi cobrado e não há nada a pagar aqui.
        </p>

        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted, #7a7590)', margin: 0 }}>
          Se você recebeu este link de quem te atende, avise: a cobrança precisa ser
          gerada novamente.
        </p>
      </div>
    </main>
  )
}
