# sdd.md — Software Design Document · Audere

> Documento de design técnico. Para requisitos veja [spec.md](./spec.md);
> para tarefas/backlog veja [tasks.md](./tasks.md).
> Última atualização: agosto 2026.

---

## 1. Visão arquitetural

Audere é um **monolito Next.js 14 (App Router)** — frontend e backend no mesmo
build/processo. As "APIs" são Route Handlers (`src/app/api/**`) e Server Actions; a
lógica de negócio vive em `src/server`. Não há serviço de backend separado.

```
Browser ── HTTPS (Cloudflare Full strict) ── Ingress nginx ── Service ── Pod (Next standalone)
                                                                              │
                          ┌───────────────────────────────────────────────────┼───────────────┐
                       PostgreSQL                Redis              Integrações externas
                  (namespace postgresql)   (namespace database)   OpenAI · Anthropic ·
                                                                  AssemblyAI · Evolution ·
                                                                  Pagar.me · Resend
```

### Camadas
- `src/app/(app)/**` — telas autenticadas (mundo clínico + prática + admin).
- `src/app/(presence)/**` — Modo Presença (sessão ao vivo).
- `src/app/lancamento/**` — landing pública.
- `src/app/api/**` — Route Handlers (webhooks, IA, cron, SSE, sala).
- `src/server/services/**` — regras de negócio (~45 módulos).
- `src/server/lib/**` — integrações e utilitários (llm, anthropic, evolution,
  pagarme*, planos, precos, email, crypto, aiGuard, turn, sse, cron, env…).
- `src/server/db/**` — pool, migrations, runner.

## 2. Stack

> **Stack e versões completas: CLAUDE.md §3.** Aqui só os pontos com implicação de design.

- **Monolito Next.js 14 (App Router)** em build `standalone` — um único processo serve
  páginas (SSR) e APIs (Route Handlers + Server Actions).
- **LLM com dois provedores** — ver §4.4.
- **Transcrição dual por canal:** Web Speech (psicólogo, no browser) + AssemblyAI
  streaming (paciente, áudio remoto do WebRTC) — ver §4.1.
- **Realtime sem servidor dedicado:** SSE para painel e signaling de vídeo; WebRTC P2P.

## 3. Modelo de dados

> **DDL base: CLAUDE.md §11.** Aqui só o que importa para o design.

- **45 migrations** em `src/server/db/migrations/NNN_*.sql`, aplicadas por
  `src/server/db/migrate.mjs` (idempotente, controla em `_migrations`).
- Campos clínicos cifrados em repouso (AES-256-GCM): `sessoes.transcricao_texto`,
  `nota_clinica`, `resumo_ia`, além de documentos e chave PIX do onboarding — §5.
- **Grafo de temas em duas camadas:**
  - `sessao_grafo` — **fonte da verdade**, um snapshot por sessão, versionado
    (`versao_prompt`, `versao_conceitualizacao`), `UNIQUE (paciente_id, sessao_id)`.
  - `palavras_chave` + `arestas_tema` — **derivados** do store, com recorrência
    **contada** (nº de sessões distintas), não inferida pelo LLM.
- `api_custos` — custo por chamada de IA com atribuição (`psicologo_id`,
  `paciente_id`, `sessao_id`, `operacao`, `natureza`, `escopo_recalculo`, latência).
- `psicologos.role` (`psicologo`|`admin`) e `organizacao_id` (gancho org-ready,
  hoje sempre NULL) — migration 022.
- Estado conversacional do WhatsApp em `wa_conversas` (chave = telefone E.164).

## 4. Fluxos-chave

### 4.1 Sessão ao vivo — transcrição dual e isolamento de falante
- O **psicólogo** é capturado pelo microfone local (Web Speech) → `who='psicologo'`.
- O **paciente** chega pelo **áudio remoto do WebRTC** → AssemblyAI → `who='paciente'`.
- **Isolamento (P7):** `getUserMedia` usa `echoCancellation/noiseSuppression/
  autoGainControl`; como rede de segurança, um turno do paciente que seja cópia
  (similaridade Jaccard ≥ 0.7) de fala recente do psicólogo é **descartado**.
- **Análise paciente-only:** Temas ao vivo, Observação ao vivo e a extração
  persistida usam apenas falas do paciente (`who='paciente'` / linhas `C:`).
  Resumo, risco e marcação usam o diálogo completo (precisam do contexto).

### 4.2 Grafo de temas — extração e recálculo incremental
- **Extração por sessão** (`extrairGrafoSessao`): produz construtos (não palavras)
  + relações, com rubrica clínica e *lente* pela abordagem do psicólogo. Parser
  tolerante a truncamento recupera objetos completos mesmo com JSON cortado.
- **Conceitualização (§8 da spec de temas):** os objetivos ativos entram no prompt
  e **só promovem** relevância — nunca rebaixam, para o grafo continuar podendo
  contradizer a hipótese do clínico (`fora_da_conceitualizacao: true`).
- **Recálculo incremental:** `recalcularGrafo` reaproveita o snapshot de qualquer
  sessão cujo `versao_prompt` e `versao_conceitualizacao` continuem válidos —
  reextrai só o que mudou. Recalcular sem mudanças custa **0 chamadas de IA**.
  Não-destrutivo: falha de extração **preserva** o snapshot anterior; só saem
  órfãos (sessão desassinada/excluída) e os que voltaram vazios. `forcar` é o
  escape hatch.
- **Custo medido:** O(n) linear no nº de sessões, **~R$ 0,0055 por sessão** no
  gpt-4o-mini (benchmark `scripts/bench-grafo.ts`, ago/2026: razão 16,3× para
  n crescendo 16×). No fluxo normal é 1 chamada por sessão assinada.

### 4.3 Pagamento confirma agendamento (P4) e split
Psicólogo agenda → WhatsApp pergunta método → Pagar.me gera cobrança **com split**
→ webhook `order.paid` → `marcarPagamentoConfirmado` move a sessão para
`confirmada`, publica SSE e confirma ao paciente por WhatsApp/email.
**Validado ponta a ponta em produção (ago/2026):** da criação da cobrança ao
evento processado, menos de 10 segundos.

> ⚠️ **Ambiente do PIX:** em conta de teste o "Modelo de negócio" do PIX precisa
> ser **Simulator**; **PSP** exige provisionamento real e faz a charge ser
> reprovada com `Sem ambiente configurado para este tipo de transação`. No live
> é o inverso. Foi o que manteve o PIX quebrado até ago/2026.

O split tem duas fatias em `flat` (centavos — 2,5% não é inteiro, e a fatia exata
é auditável e casa com o Financeiro):
- **psicólogo**: valor − taxa administrativa, com `charge_processing_fee` e `liable` (absorve
  a taxa do adquirente e responde por chargeback — o serviço é dele);
- **plataforma**: 2,5%, limpo.

As duas somam exatamente o valor da order. Sem `PAGARME_RECIPIENT_PLATAFORMA` ou
sem recipient do psicólogo, a cobrança sai **sem** split (degradação com aviso).
A taxa administrativa é gravada em `sessoes.comissao_centavos` no ato — valor real, não
reestimativa.

### 4.4 Roteamento de LLM (`src/server/lib/llm.ts`)
Camada única: todo texto/classificação de IA passa por `chat()`.

- **OpenAI primário, Anthropic fallback.** Tier `fast` = `gpt-4o-mini` (ao vivo,
  mecânicas, temas); tier `strong` = `gpt-4o` (resumo/laudo, risco, longitudinal,
  chat clínico). Default é `fast` — o caller sensível **precisa** pedir `strong`.
- **Fallback nunca é silencioso:** `fast` servido pelo Anthropic emite `ALERTA
  CUSTO` no log e alerta por email (throttle de 1h no Redis). Foi o fallback
  silencioso que originou o vazamento de custo de jun/2026.
- **Timeout adaptativo** ao `maxTokens` (5s–30s): chamada ao vivo não pode esperar
  30s; chamada generativa (laudo, grafo) não pode dar falso-timeout e cair no
  provedor caro.
- **Health-check no boot** — chave ausente/inválida grita na inicialização, em vez
  de degradar 8× por mil chamadas.
- Custo registrado em `api_custos` por **tokens reais** (best-effort,
  fire-and-forget — não bloqueia a resposta).

> ⚠️ **LGPD/CFP:** com a OpenAI primária, transcrição e nota do paciente trafegam
> para ela na maioria das chamadas. Manter a promessa "zero data training" exige
> **ZDR + DPA com a OpenAI**; sem isso, inverter a ordem em `PROVIDER_ORDER`.

### 4.5 Realtime
- **SSE** `/api/eventos` (painel) e `/api/sala/[token]/eventos` (signaling de vídeo):
  cada conexão limpa heartbeat + subscription no `cancel()`/`abort` para evitar
  vazamento e `ERR_INVALID_STATE`.
- **ICE** `/api/ice` entrega STUN + TURN. O TURN usa credencial **efêmera**
  (coturn `use-auth-secret`, HMAC com TTL) — obrigatório porque o paciente é
  anônimo e o bundle é público, então senha fixa nunca é exposta.
  Em produção o coturn roda no cluster (`k8s/coturn.yaml`, hostNetwork) atrás de
  `turn.audere.ia.br`. **Dev local não tem TURN** — cai em STUN-only.

### 4.6 Cron
Seis jobs in-process (`src/server/lib/cron.ts`, timezone America/Sao_Paulo):
lembrete 24h (18h), lembrete 2h (a cada 30min, 7–21h), lembrete 15min (5min),
liberar silenciosos (5min), perguntar método pendente (30min, 7–21h) e destravar
sessões em curso (15min). Recálculo de grafo **não** é cron — é sob demanda.

## 5. Segurança e compliance

- **AES-256-GCM** (`src/server/lib/crypto.ts`, formato `v1:iv:ct:tag`). **Trocar
  `ENCRYPTION_KEY` torna dados ilegíveis** — não rotacionar sem migração.
- **aiGuard** (`src/server/lib/aiGuard.ts`): valida e sanitiza saída da IA; bloqueia
  assinatura com termos proibidos. `CLINICAL_VOICE` prefixado em todo prompt.
- **Webhooks** (`src/server/lib/webhookAuth.ts`), três mecanismos:
  - **Pagar.me → HTTP Basic Auth.** É o que o painel oferece ("Habilitar
    autenticação" → Usuário + Senha) e o que ela envia
    (`Authorization: Basic base64(user:senha)`). **Não** manda X-Hub-Signature —
    o código validava HMAC e por isso nenhum secret jamais casaria.
    Envs: `PAGARME_WEBHOOK_USER` + `PAGARME_WEBHOOK_SECRET` (a senha).
  - **HMAC SHA-256** mantido como segundo caminho (fixo em sha256, sem derivar do
    header, para evitar downgrade a sha1).
  - **Evolution → token compartilhado** (`x-webhook-token` / `?token=`).
  Comparação sempre em tempo constante. **Fail-closed em produção**: sem nenhum
  mecanismo configurado, responde 503; em dev, aceita com warning.
- **Assinatura**: evento de renovação não ressuscita plano cancelado, e a data de
  expiração vinda do payload é **clampada** em `agora + ciclo + 7d` (anti-forja).
- **Cartão** nunca passa pelo servidor: tokenização no browser contra a API da
  Pagar.me com a chave pública.
- Áudio descartado após transcrição; consentimento auditado.
- Auth por sessão JWT; middleware protege `(app)` e `(presence)`.

## 6. Integrações externas

| Serviço | Uso | Notas |
|---------|-----|-------|
| OpenAI | **primário** — todos os tiers | `gpt-4o-mini` / `gpt-4o`; cacheia prefixo automaticamente |
| Anthropic | **fallback** | Haiku/Sonnet; `cache_control` explícito quando usado |
| AssemblyAI | transcrição do paciente | token efêmero via `/api/transcribe/token` |
| Evolution v2 | WhatsApp | payload `{ number, text }`; instância compartilhada |
| Pagar.me | cobrança, split, assinatura, recipient | API v5 via axios; sem SDK |
| Resend | email | domínio verificado (`automaxia.com.br`) |
| WebRTC | vídeo P2P | STUN público + **TURN ativo** (coturn no cluster, `lib/turn.ts`) |

## 7. Infraestrutura e deploy

- **Imagem** multi-stage (`Dockerfile`), Next standalone, usuário não-root.
- **CI/CD**: push em `main` → GitHub Actions → build → migrate → rollout.
- **Kubernetes** (namespace `aurencare`):
  - 1 Deployment (`aurencare-web`) servindo `app.` e `api.aurencare.ia.br` /
    `app.audere.ia.br`.
  - `aurencare-api` mantido apenas como **Ingress** apontando ao mesmo Service.
  - Secret `aurencare-secrets` (envs); pull secret `automaxia-secreto-docker`.
- **Migrations**: Job `k8s/migrate-job.yaml` reaproveita a imagem e roda
  `node src/server/db/migrate.mjs` (não usa `tsx` — incompleto no runtime por causa
  do `COPY` seletivo do `node_modules`).
- ⚠️ **`NEXT_PUBLIC_*` é build-time**: `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` precisa
  entrar no `--build-arg` da imagem; pôr só no secret de runtime não funciona.
- **Banco/cache no cluster**: `postgres-service.postgresql…:5432`,
  `redis.database…:6379`, Evolution `evolution-api-service.evolution…:8080`.
- **TLS**: cert-manager no origin + Cloudflare em **Full (strict)**.

### Dev local
`.env.local` (chaves reais + **banco do cluster**) + `.env.development.local`
(sobrepõe `DATABASE_URL` → `aurencare_test` em localhost). Scripts e migrations
**precisam dos dois** env-files, nesta ordem — `subir.bat` já faz isso. Rodar com
só `.env.local` aponta para **produção**.

## 8. Decisões de design (resumo)

- **D1 Monolito, 1 pod.** Rodar dois pods duplicaria o cron in-process (lembretes
  WhatsApp em dobro).
- **D2 `migrate.mjs` em JS puro.** Evita a fragilidade do `tsx` na imagem.
- **D3 Análise paciente-only (P7).**
- **D4 AEC + dedup como defesa em profundidade** contra eco entre falantes.
- **D5 Cron in-process hoje**; migrar para CronJob/fila é backlog.
- **D6 Store por-sessão versionado** como fonte da verdade do grafo — é o que
  torna o recálculo incremental possível sem cache adicional. Cache de resposta
  do LLM por hash seria redundante: o snapshot já é isso, persistido.
- **D7 Recorrência contada, não inferida.** O LLM extrai a sessão; quem conta em
  quantas sessões um construto aparece é o banco.
- **D8 Split em `flat`, não `percentage`.** 2,5% não é inteiro; a fatia em
  centavos é exata, auditável e reconciliável com o Financeiro.
- **D9 Fallback de LLM é sempre visível.** Degradação silenciosa de provedor foi
  a origem de um vazamento de custo real.
