import Link from 'next/link'
import { requireRole } from '@/server/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { estadoConexaoEvolution, webhookUrlEvolution, lerWebhookEvolution, listarInstanciasEvolution } from '@/server/lib/evolution'
import { env, isConfigured } from '@/server/lib/env'
import { estadoNumeroMeta, listarTemplatesMeta, webhookUrlMeta } from '@/server/lib/whatsapp/meta'
import { CATALOGO_META } from '@/server/lib/whatsapp/templatesMeta'
import { TesteWhatsApp } from './TesteWhatsApp'
import { RodarLembrete } from './RodarLembrete'
import { ConfigurarWebhook } from './ConfigurarWebhook'
import { TemplatesMeta } from './TemplatesMeta'

export const dynamic = 'force-dynamic'

export default async function WhatsAppDiagPage() {
  await requireRole('admin')
  if (env.whatsappProvider === 'meta') return <DiagMeta />
  const c = await estadoConexaoEvolution()
  const conectado = c.state === 'open'
  // Quando dá erro (ex.: 404 de instância inexistente), lista as instâncias reais
  // do servidor pra revelar o nome correto a usar em EVOLUTION_INSTANCE_NAME.
  const instancias = c.erro ? await listarInstanciasEvolution() : null
  const wh = await lerWebhookEvolution().catch(() => null)
  const webhookAtual: string | null = (wh as any)?.url ?? (wh as any)?.webhook?.url ?? null

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
        {instancias && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            {instancias.ok
              ? instancias.nomes.length > 0
                ? <>Instâncias que <strong>existem</strong> neste servidor Evolution: {instancias.nomes.map((n, i) => <span key={n}>{i > 0 && ', '}<code style={{ background: 'var(--surface)', padding: '1px 6px', borderRadius: 5 }}>{n}</code></span>)}.
                    {' '}Ajuste <code>EVOLUTION_INSTANCE_NAME</code> para bater exatamente com um destes (diferencia maiúsculas).</>
                : <>O servidor respondeu, mas <strong>nenhuma instância</strong> existe — é preciso criá-la no Evolution antes.</>
              : <>Não consegui listar as instâncias ({instancias.erro}). Verifique <code>EVOLUTION_API_URL</code> e <code>EVOLUTION_API_KEY</code>.</>}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="sec-lbl" style={{ marginBottom: 10 }}>Configuração</div>
        <Linha k="Integração" v={c.configurado ? 'Configurada' : 'Modo demonstração (sem envio real)'} />
        <Linha k="Instância" v={c.instancia} />
        <Linha k="Estado da conexão" v={c.state ?? (c.configurado ? '—' : 'n/d')} />
        <Linha k="Webhook esperado" v={webhookUrlEvolution()} mono />
      </div>

      <ConfigurarWebhook atual={webhookAtual} />

      <TesteWhatsApp habilitado={c.configurado} />

      <RodarLembrete />

      <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.6, maxWidth: 760 }}>
        O agendamento de sessão dispara o WhatsApp do método de pagamento automaticamente — o código está correto.
        Se as mensagens não chegam, é aqui que está a causa: <strong>integração não configurada</strong> ou
        <strong> instância desconectada</strong> (QR expirado). O convite de consentimento pode ter chegado por
        <strong> email</strong> mesmo com o WhatsApp fora do ar.
      </p>
    </div>
  )
}

/**
 * Diagnóstico do provider `meta` (Cloud API). Sem QR nem instância: o que
 * pode estar errado é token, número não verificado, nome de exibição em
 * análise, templates pendentes ou webhook não assinado no app Meta.
 */
async function DiagMeta() {
  const n = await estadoNumeroMeta()
  const lista = await listarTemplatesMeta()
  const porNome = new Map(lista.templates.filter(t => t.language === 'pt_BR').map(t => [t.name, t]))
  const linhas = Object.keys(CATALOGO_META).map(name => ({
    name, status: porNome.get(name)?.status ?? null, rejected_reason: porNome.get(name)?.rejected_reason ?? null,
  }))

  const verificado = n.verificacao === 'VERIFIED'
  const nomeOk = n.statusNome === 'APPROVED'
  const status = !n.configurado
    ? { cor: 'var(--rose)', titulo: 'Cloud API não configurada (modo demonstração)', desc: 'META_WA_TOKEN e/ou META_WA_PHONE_NUMBER_ID ausentes. Nenhuma mensagem de WhatsApp é enviada de verdade — só log.' }
    : n.erro
    ? { cor: 'var(--rose)', titulo: 'Erro ao consultar o número na Meta', desc: `A Graph API respondeu com erro (${n.erro}). Token expirado/sem permissão whatsapp_business_messaging, ou o phone_number_id não pertence a este token.` }
    : !verificado
    ? { cor: 'var(--amber)', titulo: `Número não verificado (${n.verificacao ?? 'desconhecido'})`, desc: `O número ${n.telefone ?? ''} existe na WABA mas ainda não passou pela verificação por SMS/ligação. Enquanto isso a Meta recusa todo envio. Verifique no Gerenciador do WhatsApp → Números de telefone.` }
    : !nomeOk
    ? { cor: 'var(--amber)', titulo: `Nome de exibição em análise (${n.statusNome ?? '—'})`, desc: `"${n.nomeExibicao ?? ''}" ainda não foi aprovado pela Meta. Dá pra enviar, mas o paciente vê só o telefone até aprovar.` }
    : { cor: 'var(--sage)', titulo: 'Conectado à Cloud API', desc: `${n.telefone} · "${n.nomeExibicao}" · qualidade ${n.qualidade ?? '—'} · limite ${n.limite ?? '—'}. O envio deve funcionar — mande um teste abaixo.` }

  return (
    <div>
      <PageHeader
        title="Diagnóstico de WhatsApp"
        subtitle="Cloud API (Meta) · número próprio da Audere"
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
        <Linha k="Provider" v="meta (Cloud API)" />
        <Linha k="Phone Number ID" v={n.phoneNumberId ?? '—'} mono />
        <Linha k="WABA ID" v={env.metaWabaId ?? '—'} mono />
        <Linha k="Telefone" v={n.telefone ?? '—'} />
        <Linha k="Nome de exibição" v={n.nomeExibicao ? `${n.nomeExibicao} (${n.statusNome ?? '—'})` : '—'} />
        <Linha k="Verificação do número" v={n.verificacao ?? '—'} />
        <Linha k="Webhook (Configuração → Webhooks → WhatsApp)" v={webhookUrlMeta()} mono />
        <Linha k="Verify token" v={isConfigured(env.metaVerifyToken) ? 'configurado' : 'AUSENTE — handshake vai falhar'} />
        <Linha k="App Secret (assinatura)" v={isConfigured(env.metaAppSecret) ? 'configurado' : 'AUSENTE — webhook rejeita em produção'} />
      </div>

      <TemplatesMeta linhas={linhas} erroLista={lista.ok ? undefined : lista.erro} />

      <TesteWhatsApp habilitado={n.configurado && !n.erro} />

      <RodarLembrete />

      <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 14, lineHeight: 1.6, maxWidth: 760 }}>
        Na Cloud API não existe QR Code: o número vive na conta Meta da Automaxia. Se nada chega,
        as causas em ordem: <strong>número não verificado</strong>, <strong>token sem permissão</strong>,
        <strong> template pendente</strong> (mensagens automáticas) ou <strong>webhook não assinado</strong> no
        app Meta (respostas do paciente). O teste abaixo usa texto livre: só chega se o número de destino
        escreveu pra cá nas últimas 24h — pra testar fora da janela, use um template aprovado.
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
