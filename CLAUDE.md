# CLAUDE.md — Auren Care
> Este arquivo é lido automaticamente pelo Claude Code. Contém todo o contexto do projeto.
> Última atualização: junho 2026
>
> 📚 **Documentação complementar em [`docs/`](./docs/):**
> [`spec.md`](./docs/spec.md) (especificação funcional) ·
> [`sdd.md`](./docs/sdd.md) (design técnico/arquitetura) ·
> [`tasks.md`](./docs/tasks.md) (tarefas e backlog).

---

## 1. O QUE É O AUREN CARE

**"Sistema Operacional da Prática Clínica"** — plataforma SaaS para psicólogos clínicos privados.

Não é um ERP, não é prontuário hospitalar. É a infraestrutura operacional e cognitiva da prática clínica moderna: agenda, pagamentos, WhatsApp, transcrição de sessão, análise longitudinal e inteligência clínica em um único produto.

**Público:** Psicólogo(a) clínico(a) · prática online ou híbrida · 15–30 pacientes ativos.

---

## 2. PREMISSAS INEGOCIÁVEIS

1. **IA nunca emite diagnóstico** — CFP 09/2024. Qualquer texto gerado pela IA deve usar linguagem de frequência e observação, nunca clínica ou diagnóstica.
2. **Toda nota abre como rascunho** — o psicólogo assina. Nunca salvar como "final" sem assinatura.
3. **Zero data training** — nenhum dado de paciente é usado para treinar modelos. Visível na interface.
4. **Pagamento confirma o agendamento** — zero inadimplência. Sessão só aparece como confirmada após webhook de pagamento.
5. **Paciente não instala nada** — WhatsApp é a única interface do paciente.
6. **CFP badge visível** em todas as telas com conteúdo gerado por IA.

---

## 3. STACK TÉCNICA

```
Frontend:    Next.js 14+ · App Router · TypeScript · Tailwind CSS
Backend:     Node.js + Express (ou Next.js API routes)
Banco:       PostgreSQL + Redis (cache/sessões)
Auth:        NextAuth.js
Storage:     S3-compatible (áudio temporário)
WhatsApp:    Evolution API (Baileys)
Pagamentos:  Pagar.me (PIX · crédito até 6x · débito)
IA:          Anthropic API · claude-sonnet-4-20250514
Transcrição: Whisper ou AssemblyAI (pt-BR nativo)
Realtime:    WebSocket (sessão ao vivo) + SSE (notificações)
```

### Variáveis de ambiente (.env.local)
```env
ANTHROPIC_API_KEY=sk-ant-...
EVOLUTION_API_URL=https://...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE_NAME=auren-care
PAGARME_API_KEY=ak_live_...
PAGARME_WEBHOOK_SECRET=...
PAGARME_ENCRYPTION_KEY=ek_live_...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=...
```

---

## 4. DESIGN SYSTEM

### Paleta de cores
```css
--accent:    #6a4ec8   /* roxo — mundo clínico */
--sage:      #5a9e8a   /* teal — confirmações, positivo */
--rose:      #c4607a   /* rose — alertas */
--amber:     #b07d40   /* âmbar — atenção */
--page:      #f9f8f5   /* fundo off-white quente */
--surface:   #f1efe9   /* areia suave */
--card:      #ffffff
--ink:       #1a1825   /* texto escuro */
--ink-soft:  #38324e
--muted:     #7a7590
--faint:     #b0acc4
--sb-bg:     #f0eef9   /* sidebar lavanda suave */
--border:    rgba(26,24,37,.055)
```

### Tipografia
```
Display/títulos: Cormorant Garamond (Google Fonts) — weight 300/400/500, italic
Corpo/UI:        DM Sans (Google Fonts) — weight 300/400/500
Transcrições:    DM Mono
```

### Logomarca — Proposta B (Espiral de Continuidade)
A logo é uma espiral construída em 3 arcos progressivos + ponto final:
```svg
<!-- Arco 1 — interno, opacity .5 -->
<path d="M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16" stroke="..." stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".5"/>
<!-- Arco 2 — médio, opacity .75 -->
<path d="M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42" stroke="..." stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".75"/>
<!-- Arco 3 — externo, completo -->
<path d="M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 38 6 46 14 46 26" stroke="..." stroke-width="2.2" stroke-linecap="round" fill="none"/>
<!-- Ponto final -->
<circle cx="46" cy="26" r="3" fill="..."/>
```

Background do ícone: `linear-gradient(145deg, #7b5ee8, #5a9e8a)`

### Wordmark
```
"Auren" — Cormorant Garamond weight 300, color #291860
"Care"  — Cormorant Garamond weight 500, gradient #6a4ec8→#5c9d88 via background-clip:text
```

### Sidebar
- Background: `#efecf7` (lavanda suave)
- Border-right: `1px solid rgba(106,78,200,.085)`
- Width expandida: 228px · colapsada: 52px
- Item ativo (mundo clínico): `background: rgba(106,78,200,.10)` · cor `#391d96`
- Item ativo (mundo prática): `background: rgba(92,157,136,.10)` · cor `#26614e`

---

## 5. NAVEGAÇÃO — ROTAS E PÁGINAS

### Mundo Clínico
| Rota | Nome na sidebar | Ícone |
|------|----------------|-------|
| `/` | Início | ◈ |
| `/pacientes` | Pacientes | ◉ |
| `/pacientes/[id]/objetivos` | Objetivos e Progresso | ◬ |
| `/pacientes/[id]/temas` | Temas Recorrentes | ◍ |
| `/pacientes/[id]/evolucao` | Evolução Registrada | ◫ |
| `/sessao/[id]` | (Modo Presença — fullscreen) | — |

### Mundo Prática
| Rota | Nome na sidebar | Ícone |
|------|----------------|-------|
| `/financeiro` | Financeiro | ◑ |
| `/agenda` | Agenda | ◷ |
| `/saude` | Saúde da Prática | ◬ |

---

## 6. COMPONENTES PRINCIPAIS

### Layout raiz (`app/layout.tsx`)
- Sidebar fixa à esquerda (228px / 52px colapsada)
- Topbar sticky (54px altura, backdrop-blur)
- Pill de contexto na topbar: muda de cor ao navegar entre mundos
- Sessão ativa: pill pulsante `● Fernanda K. · em andamento` na topbar

### Topbar
```tsx
// Pill de sessão ativa (quando há sessão em andamento)
<div className="sess-pill" onClick={() => router.push('/sessao/current')}>
  <span className="rp-dot animate-pulse" />
  <span>Fernanda K. · em andamento</span>
</div>
```

### Dashboard (Início)
Hierarquia de 3 níveis:
1. **Foco imediato** — próxima sessão dominante (horário em 52px Cormorant), agenda do dia
2. **Continuidade** — pendências, KPI quieto da semana
3. **Inteligência silenciosa** — expandível com "↓ Observações" (riscos de evasão, etc.)

---

## 7. MODO PRESENÇA (SESSÃO AO VIVO)

Quando o psicólogo inicia uma sessão, a interface entra em Modo Presença:
- Sidebar desaparece
- Topbar desaparece
- Aparece apenas a `PresenceBar` (46px, minimalista)
- Layout: 2 colunas — transcrição (1fr) + painel direito (600px, grid 2 colunas)

### PresenceBar
```tsx
<div className="pbar">
  <div>
    <span className="pb-name">Fernanda K.</span>
    <span className="pb-meta">· Sessão 7 · Online · {timer}</span>
  </div>
  <div className="pb-actions">
    <RecordingIndicator /> {/* "Presente" com dot verde pulsando lento */}
    <Button onClick={endSession}>Encerrar</Button>
    <Button onClick={exitPresence}>← Voltar</Button>
  </div>
</div>
```

### Painel direito — widgets (arrastáveis)
1. **Ritmo da conversa** — barras Psicóloga/Paciente com %, clicáveis para rebalancear
2. **Temas desta sessão** — mini-grafo ao vivo (canvas, fundo #faf9f6)
3. **Checagem de humor** — slider bipolar −5…+5, 3 momentos, escalas F/I/D
4. **Informações do paciente** — condições, CID, medicações, alertas
5. **Avaliação de risco** — Autolesão / Ideação / Plano (Baixo/Médio/Alto)
6. **Última sessão** — bullets do contexto anterior
7. **Tópicos em aberto** — do prontuário
8. **Nota rápida** — textarea livre

Widgets marcados como `.wide` (`class="talk-card wide"` / `class="sp wide"` / `class="qnote wide"`) ocupam as 2 colunas do grid.

### Classes CSS dos widgets de sessão
```css
/* Grid do painel direito */
.sess-right {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-flow: dense;
  gap: 12px;
  align-content: start;
  height: 100%;
  overflow-y: auto;
}
.sess-right > .wide { grid-column: 1 / -1 }

/* Widget grip (aparece no hover) */
.widget-grip { opacity: 0; cursor: grab; }
[data-widget-id]:hover .widget-grip { opacity: 1 }

/* Ritmo */
.rh-bar.psic > span { background: var(--accent); opacity: .7 }
.rh-bar.pac  > span { background: var(--sage);   opacity: .7 }

/* Segmentos — botões com borda esquerda colorida */
.seg-btn[data-color="accent"] { border-left-color: rgba(106,78,200,.32) }
.seg-btn[data-color="rose"]   { border-left-color: rgba(196,96,122,.32) }
.seg-btn[data-color="sage"]   { border-left-color: rgba(90,158,138,.32) }
.seg-btn.armed { font-weight: 500 } /* ativo para marcar */

/* Turno marcado */
.turn[data-mark="insight"]       { background: var(--accent-lo); box-shadow: inset 3px 0 0 var(--accent) }
.turn[data-mark="comportamento"] { background: var(--rose-lo);   box-shadow: inset 3px 0 0 var(--rose) }
.turn[data-mark="avanco"]        { background: var(--sage-lo);   box-shadow: inset 3px 0 0 var(--sage) }

/* Slider emocional bipolar −5…+5 */
/* Gradiente: roxo (desagradável) → neutro → âmbar (agradável) */
.emo-track {
  background: linear-gradient(90deg,
    rgba(106,78,200,.7) 0%, rgba(106,78,200,.4) 22%,
    #b8d8d2 50%,
    rgba(224,200,137,.55) 78%, rgba(218,180,86,.85) 100%
  );
}

/* Avaliação de risco — pills */
.risk-pill.lo.on { background: rgba(90,158,138,.13);  color: #3a6e60 }
.risk-pill.md.on { background: rgba(168,120,64,.13);  color: #7a5520 }
.risk-pill.hi.on { background: rgba(192,94,120,.13);  color: var(--rose) }

/* Temas card — fundo orgânico (não dark) */
.themes-card {
  background: radial-gradient(ellipse at 25% 30%, rgba(106,78,200,.04) 0%, transparent 55%),
              radial-gradient(ellipse at 80% 70%, rgba(90,158,138,.04) 0%, transparent 55%),
              var(--card);
}
```

### Checagem de humor — labels do slider
```typescript
const emoLabels: Record<string, string> = {
  '-5': 'Extremamente desagradável',
  '-4': 'Muito desagradável',
  '-3': 'Desagradável',
  '-2': 'Levemente desagradável',
  '-1': 'Pouco desagradável',
   '0': 'Neutro',
   '1': 'Pouco agradável',
   '2': 'Levemente agradável',
   '3': 'Agradável',
   '4': 'Muito agradável',
   '5': 'Extremamente agradável'
}
```

### Escalas F/I/D — mapeamento de valores
```typescript
const scaleLabels = {
  freq: [[0,'Nunca'],[20,'Algumas vezes'],[40,'Diariamente'],[60,'Muitas vezes ao dia'],[85,'O tempo todo']],
  int:  [[0,'Nenhum'],[25,'Leve'],[50,'Moderado'],[75,'Forte'],[90,'Extremo']],
  dur:  [[0,'Sem humor'],[15,'1h ou menos'],[35,'2–4 horas'],[55,'8–12 horas'],[75,'1–2 dias'],[90,'7 dias']]
}
``` (`class="talk-card wide"` / `class="sp wide"` / `class="qnote wide"`) ocupam as 2 colunas do grid.

### Marcação de segmentos na transcrição
Cada turno da transcrição é clicável. O psicólogo pode marcar:
- "Insight relevante" (roxo)
- "Comportamento problema" (rose)
- "Avanço terapêutico" (sage)

O turno marcado recebe highlight lateral colorido + chip de label.

### WebSocket (transcrição ao vivo)
```typescript
// Mensagens recebidas do servidor
type WSMessage =
  | { type: 'transcricao'; turno: 'psicologo' | 'paciente'; texto: string; parcial: boolean; timestamp: string }
  | { type: 'tom'; turno: string; valor: 'calmo' | 'tenso' | 'ansioso' | 'aberto' | 'fechado' | 'acolhedor' }
  | { type: 'fala'; psicologo: number; paciente: number }
  | { type: 'palavra'; palavra: string; frequencia: number; cluster: string }

const ws = new WebSocket(`wss://${process.env.NEXT_PUBLIC_API_URL}/sessao/${sessaoId}/live`)
```

---

## 8. GRAFO DE TEMAS RECORRENTES

Canvas force-directed com física:
```typescript
// Clusters e cores
const CLUSTER_COLORS = {
  emocional:   '#6a4ec8',
  relacional:  '#c4607a',
  situacional: '#5a9e8a',
  cognitivo:   '#b07d40'
}

// Física
nodes.forEach(n => {
  // Repulsão entre nós
  const repel = 2600 / (dist * dist)
  // Atração por arestas
  const spring = (dist - 105) * 0.004
  // Centro de gravidade
  fx += (canvasW/2 - n.cx) * 0.003
  // Amortecimento
  n.vx = (n.vx + fx) * 0.82
})

// Fundo: radial-gradient orgânico escuro
// background: radial-gradient(ellipse at 32% 42%, #1e1830 0%, #141022 55%, #0e0c18 100%)

// Nós com bloom glow ao selecionar
// Arestas com opacity proporcional ao weight (co-ocorrência)
```

---

## 9. CHAT DE IA (EVOLUÇÃO REGISTRADA + TEMAS)

### System prompt — Evolução Registrada
```
Você apoia a continuidade clínica de psicólogos, organizando observações de sessões.
Use APENAS linguagem de frequência e observação factual.
NUNCA: diagnóstico, interpretação clínica, "a paciente tem", "esquema de", "transferência".
USE: "frequência crescente", "co-ocorre em X sessões", "padrão observado", "tendência de redução".
Máx. 140 palavras. Português brasileiro.
```

### System prompt — Temas Recorrentes
```
Você analisa o mapa de correlações de palavras extraído de transcrições de sessões.
Responda sobre frequências, co-ocorrências e tendências.
NÃO interprete clinicamente. NÃO emita diagnósticos.
Máx. 140 palavras. Português brasileiro.
```

### Implementação
```typescript
// Chamar a API Anthropic
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: conversationHistory.slice(-8)
  })
})
```

### Badge CFP obrigatório
```tsx
// Aparece em TODAS as telas com conteúdo de IA
<div className="cfp-badge">
  <span>🧭</span>
  <span>Apoio à reflexão · não substitui avaliação clínica · CFP 09/2024</span>
</div>
```

---

## 10. FLUXO WHATSAPP (Evolution API)

### 6 fluxos principais

**Fluxo 1 — Cadastro**
```
Psicóloga cadastra → backend gera token → Evolution API envia boas-vindas + link consentimento
```

**Fluxo 2 — Agendamento + pagamento**
```
Psicóloga agenda → Evolution API pergunta: "PIX, CREDITO ou DEBITO?" →
  PIX:     Pagar.me gera QR code → envia via WA (expira 30min)
  Crédito: Pagar.me gera checkout → envia link via WA (expira 2h, até 6x)
  Débito:  Pagar.me gera checkout → envia link via WA (expira 2h)
→ Webhook Pagar.me (order.paid) → sessão confirmada → SSE notifica painel → WA confirma ao paciente
```

**Fluxo 3 — Lembretes automáticos**
```
Cron 18h00: lembrete 24h → "CONFIRMAR" ou "CANCELAR"
Cron 08h00: lembrete 2h antes
```

**Fluxo 4 — Webhook Evolution (parser)**
```typescript
const texto = message.conversation?.toUpperCase().trim()
if (texto === 'PIX') await gerarCobrancaPix(sessao, paciente)
if (texto === 'CREDITO') await gerarCheckoutCartao(sessao, paciente, 'credit_card')
if (texto === 'DEBITO') await gerarCheckoutCartao(sessao, paciente, 'debit_card')
if (texto === 'CONFIRMAR') await confirmarSessao(paciente)
if (texto === 'CANCELAR') await cancelarSessao(paciente)
// else: notificar psicóloga no painel
```

**Fluxo 5 — Cancelamento + reembolso**
```
> 24h: reembolso automático (PIX: 1 dia · crédito: até 30 dias · débito: 5 dias)
< 24h: sem reembolso (configurável)
```

**Fluxo 6 — Pós-sessão**
```
Registro assinado → Evolution API envia pós-sessão ao paciente
```

### Helper de envio
```typescript
async function enviarWA(instancia: string, telefone: string, texto: string) {
  const number = `55${telefone.replace(/\D/g, '')}@s.whatsapp.net`
  await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${instancia}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': process.env.EVOLUTION_API_KEY! },
    body: JSON.stringify({ number, textMessage: { text: texto } })
  })
}
```

---

## 11. MODELOS DE DADOS (PostgreSQL)

```sql
-- Psicólogos
CREATE TABLE psicologos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  crp VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  wa_instancia VARCHAR(100),
  wa_conectado BOOLEAN DEFAULT false,
  pagarme_recipient_id VARCHAR(100),
  valor_sessao DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pacientes
CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id UUID NOT NULL REFERENCES psicologos(id),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  consentimento_aceito BOOLEAN DEFAULT false,
  consentimento_timestamp TIMESTAMPTZ,
  consentimento_token VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'ativo',
  UNIQUE(psicologo_id, telefone)
);

-- Sessões
CREATE TABLE sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id UUID NOT NULL REFERENCES psicologos(id),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  numero INTEGER NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_min INTEGER DEFAULT 50,
  modalidade VARCHAR(20) DEFAULT 'online',
  status VARCHAR(30) DEFAULT 'agendada',
  -- status: agendada | aguardando_metodo | aguardando_pagamento | confirmada | em_curso | concluida | cancelada
  pagamento_status VARCHAR(20) DEFAULT 'pendente',
  pagamento_metodo VARCHAR(20), -- pix | credito | debito
  pagamento_parcelas INTEGER DEFAULT 1,
  pagarme_order_id VARCHAR(100),
  pagarme_qrcode TEXT,
  pagarme_qrcode_url TEXT,
  pagarme_checkout_url TEXT,
  valor DECIMAL(10,2),
  wa_metodo_escolhido BOOLEAN DEFAULT false,
  wa_lembrete_24h BOOLEAN DEFAULT false,
  wa_lembrete_2h BOOLEAN DEFAULT false,
  transcricao_texto TEXT, -- AES-256 em repouso
  resumo_ia TEXT,
  nota_clinica TEXT,
  assinada BOOLEAN DEFAULT false,
  assinatura_timestamp TIMESTAMPTZ,
  indicadores JSONB,
  palavras_chave JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 12. API ENDPOINTS

```
# Auth
POST   /api/auth/login
POST   /api/auth/logout

# Pacientes
GET    /api/pacientes          ?filtro=&busca=
POST   /api/pacientes
GET    /api/pacientes/[id]
PUT    /api/pacientes/[id]

# Sessões
GET    /api/sessoes            ?pacienteId=&inicio=&fim=
POST   /api/sessoes
PUT    /api/sessoes/[id]
POST   /api/sessoes/[id]/iniciar
POST   /api/sessoes/[id]/encerrar
POST   /api/sessoes/[id]/assinar
POST   /api/sessoes/[id]/reenviar-cobranca

# Dashboard
GET    /api/dashboard
GET    /api/agenda             ?inicio=&fim=&view=semana

# Análise IA
GET    /api/analise/grafo/[pacienteId]
GET    /api/analise/longitudinal/[pacienteId]
POST   /api/analise/chat

# Onboarding paciente (público)
GET    /onboard/[token]
POST   /onboard/[token]/aceitar

# Webhooks
POST   /api/webhooks/pagarme
POST   /api/webhooks/evolution

# Realtime
WS     /api/sessao/[id]/live
GET    /api/eventos            (SSE)
```

---

## 13. REGRAS DE NEGÓCIO CRÍTICAS

### Badge automático de paciente
```typescript
function calcularBadge(sessoes: Sessao[]) {
  const dias = daysDiff(sessoes[0]?.data_hora, new Date())
  const noShows = sessoes.slice(0, 5).filter(s => s.status === 'no_show').length
  const pendentes = sessoes.filter(s => s.status === 'concluida' && !s.assinada)
  if (noShows >= 2)         return { label: 'Atenção',    color: 'rose' }
  if (dias > 14)            return { label: 'Espaçando',  color: 'amber' }
  if (sessoes.length < 4)   return { label: 'Nova',       color: 'info' }
  if (pendentes.length > 0) return { label: 'Registrar',  color: 'amber' }
  return null
}
```

### Validação de texto da IA
> Implementada no **backend** (API route), não no frontend.
```typescript
const TERMOS_PROIBIDOS = [
  'diagnóstico', 'o paciente tem', 'a paciente tem',
  'esquema de', 'transferência', 'indica fortemente',
  'possível elaboração', 'comprova', 'confirma'
]
function validarTextoIA(texto: string): boolean {
  return !TERMOS_PROIBIDOS.some(t => texto.toLowerCase().includes(t.toLowerCase()))
}
```

### Pós-sessão
Modal abre automaticamente ao encerrar. Contém:
- Resumo gerado pela IA (rascunho editável)
- Botão assinar documento
- Status do pagamento
- Reagendamento rápido

---

## 14. LGPD + CFP

- **AES-256** em repouso para `transcricao_texto`, `nota_clinica`, `resumo_ia`
- **TLS 1.3** em trânsito
- Áudio bruto: capturar → transcrever → **descartar imediatamente**
- Zero data training: cláusula com Anthropic Enterprise
- Consentimento via WhatsApp com timestamp
- Assinatura obrigatória antes de qualquer nota "virar" prontuário

---

## 15. ESCOPO — STATUS ATUAL

> O projeto está **em produção** (https://aurencare.automaxia.com.br/) e já cobre
> Fase 1 + parte da Fase 2. Detalhe e backlog em [`docs/tasks.md`](./docs/tasks.md).

### ✅ Implementado e em produção
- Auth (login/logout) + cadastro público de psicólogo
- Dashboard com agenda do dia e KPIs
- Pacientes: cadastro (dispara **WhatsApp + email**), lista com filtros, perfil, arquivar
- Agenda (dia/semana/mês) + nova sessão (avulsa e série)
- Evolution API: **7 fluxos** (inclui confirmação pós-sessão)
- Pagar.me: PIX + crédito (6x) + débito + webhook
- Resend: email transacional (domínio verificado)
- Modo Presença: transcrição **dual** (psicólogo Web Speech + paciente AssemblyAI),
  9 widgets, marcação, **vídeo WebRTC P2P**, isolamento de falante, **análise paciente-only**
- Pós-sessão: resumo IA + assinatura + sugestões
- **Temas Recorrentes (grafo)** e **Evolução longitudinal** com chat de IA  ← era Fase 2
- Financeiro + NF + exportação contábil/tributária; Saúde da Prática (KPIs)
- CFP badge + AES-256 + consentimento + aiGuard

### 🔮 Futuro / fora de escopo
- Modo supervisor (Fase 3)
- App mobile
- Agendamento inbound pelo paciente via WhatsApp
- Itens de hardening (validação de assinatura de webhooks, TURN, etc.) — ver `docs/tasks.md`

---

## 15.1 DEPLOY (Kubernetes)

- **Monolito, 1 pod** (`aurencare-web`): frontend e API são o mesmo app/imagem. Os
  hosts `aurencare.automaxia.com.br` (e `api.`) apontam para o mesmo Service.
- **kubeconfig**: `local.yaml` (cluster Rancher) — usar `kubectl --insecure-skip-tls-verify`.
- **Imagem**: `wesleyromualdo/aurencare-web:latest`. Migrations: `k8s/migrate-job.yaml`
  (`node src/server/db/migrate.mjs`, idempotente — **não** usa `tsx`).
- **Secret** `aurencare-secrets`: todas as envs. Banco/cache/Evolution já com hosts
  in-cluster. ⚠️ `ENCRYPTION_KEY` não é rotacionável sem migração (cifra dados clínicos).
- Detalhes de arquitetura e decisões em [`docs/sdd.md`](./docs/sdd.md).

---

## 16. PROTÓTIPO DE REFERÊNCIA

O arquivo `Auren-Care-v12.html` contém o protótipo interativo completo com:
- Todas as telas implementadas em HTML/CSS/JS puro
- Design system completo
- Grafo force-directed funcional
- Chat IA real conectado à Anthropic API
- Modo Presença com todos os widgets
- Agenda com 3 visões (dia/semana/mês)

**Ao implementar qualquer tela, consulte o protótipo como referência visual e de comportamento.**

### Validação automática do protótipo
Resultado da validação v12.5 vs requisitos CLAUDE.md: **51/53 requisitos presentes** (97%).
- ✅ Todos os componentes visuais, tokens de cor, navegação, modo sessão, grafo, chat IA, agenda 3 visões, fluxo WA, financeiro.
- ⚠️ Sidebar bg real no protótipo: `#f0eef9` (lavanda ligeiramente mais saturada que `#efecf7` — ambas aceitáveis).
- ⚠️ Validação de termos proibidos da IA: implementar no backend, não no frontend.

---

## 17. CONVENÇÕES DO PROJETO

### Nomenclatura de componentes
```
components/
  layout/
    Sidebar.tsx
    Topbar.tsx
    PresenceBar.tsx
  dashboard/
    NextSession.tsx    -- bloco dominante da próxima sessão
    AgendaList.tsx     -- lista do dia
    KpiQuiet.tsx       -- card de KPI silencioso
    IntelSection.tsx   -- inteligência silenciosa (expandível)
  session/
    TranscriptionCard.tsx
    RhythmWidget.tsx
    ThemesCanvas.tsx   -- mini-grafo ao vivo
    HumorCheck.tsx
    RiskAssessment.tsx
    SegmentMarker.tsx
  grafo/
    GrafoCanvas.tsx    -- grafo principal force-directed
    NodeDetail.tsx
    AiChat.tsx         -- chat de apoio
  pacientes/
    PatientCard.tsx
    PatientSelector.tsx
    NewPatientModal.tsx
```

### Tom da interface
- IA age muito, aparece pouco
- Sem linguagem analítica ou diagnóstica
- Sem badges agressivos
- "Presente" em vez de "Gravando" ou "Monitorando"
- "Registro assistido" em vez de "Transcrição ao vivo"
- "Temas Recorrentes" em vez de "Mapa de Padrões"
- "Evolução Registrada" em vez de "Análise Longitudinal"
- "Sem comparecimento" em vez de "No-show"
- "Valor médio por sessão" em vez de "Ticket médio"

---

*Auren Care · CLAUDE.md · maio 2026 · Daniel Versiani · Luiz Filho · Wesley Romualdo*
