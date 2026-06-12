import Link from 'next/link'
import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { estadoConexaoEvolution, webhookUrlEvolution } from '@/server/lib/evolution'
import { TesteWhatsApp } from './TesteWhatsApp'

export const dynamic = 'force-dynamic'

export default async function WhatsAppDiagPage() {
  await requireRole('admin')
  const c = await estadoConexaoEvolution()
  const conectado = c.state === 'open'

  const status = !c.configurado
    ? { cor: 'var(--rose)', titulo: 'Não configurado (modo demonstração)', desc: 'EVOLUTION_API_URL e/ou EVOLUTION_API_KEY ausentes. Nenhuma mensagem de WhatsApp é enviada de verdade — só log. É a causa mais comum de "não chega".' }
    : c.erro
    ? { cor: 'var(--rose)', titulo: 'Erro ao consultar a instância', desc: `A API respondeu com erro (${c.erro}). Verifique a URL/chave e se a instância "${c.instancia}" existe.` }
    : conectado
    ? { cor: 'var(--sage)', titulo: 'Conectado', desc: `A instância "${c.instancia}" está com o WhatsApp conectado (state: open). O envio deve funcionar — mande um teste abaixo.` }
    : { cor: 'var(--amber)', titulo: `WhatsApp desconectado (state: ${c.state ?? 'desconhecido'})`, desc: `A instância "${c.instancia}" existe, mas o número de WhatsApp NÃO está conectado — é preciso reescanear o QR Code no servidor Evolution. Enquanto desconectado, as mensagens não são entregues.` }

  return (
    <div>
      <PageHeader
        title="Diagnóstico de WhatsApp"
        subtitle="Por que as mensagens não estão chegando?"
        actions={<Link href="/admin" className="btn ghost">← Administração</Link>}
      />

      <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: `4px solid ${status.cor}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: status.cor }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{status.titulo}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>{status.desc}</p>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="sec-lbl" style={{ marginBottom: 10 }}>Configuração</div>
        <Linha k="Integração" v={c.configurado ? 'Configurada' : 'Modo demonstração (sem envio real)'} />
        <Linha k="Instância" v={c.instancia} />
        <Linha k="Estado da conexão" v={c.state ?? (c.configurado ? '—' : 'n/d')} />
        <Linha k="Webhook esperado" v={webhookUrlEvolution()} mono />
      </div>

      <TesteWhatsApp habilitado={c.configurado} />

      <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.6, maxWidth: 760 }}>
        O agendamento de sessão dispara o WhatsApp do método de pagamento automaticamente — o código está correto.
        Se as mensagens não chegam, é aqui que está a causa: <strong>integração não configurada</strong> ou
        <strong> instância desconectada</strong> (QR expirado). O convite de consentimento pode ter chegado por
        <strong> email</strong> mesmo com o WhatsApp fora do ar.
      </p>
    </div>
  )
}

function Linha({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', textAlign: 'right', fontFamily: mono ? 'var(--font-mono), monospace' : undefined, wordBreak: 'break-all' }}>{v}</span>
    </div>
  )
}
