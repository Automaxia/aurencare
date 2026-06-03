# sdd.md — Software Design Document · Auren Care

> Documento de design técnico. Para requisitos veja [spec.md](./spec.md);
> para tarefas/backlog veja [tasks.md](./tasks.md).
> Última atualização: junho 2026.

---

## 1. Visão arquitetural

Auren Care é um **monolito Next.js 14 (App Router)** — frontend e backend no mesmo
build/processo. As "APIs" são Route Handlers (`src/app/api/**`) e Server Actions; a
lógica de negócio vive em `src/server`. Não há serviço de backend separado.

```
Browser ── HTTPS (Cloudflare Full strict) ── Ingress nginx ── Service ── Pod (Next standalone)
                                                                              │
                          ┌───────────────────────────────────────────────────┼───────────────┐
                       PostgreSQL                Redis              Integrações externas
                  (namespace postgresql)   (namespace database)   Anthropic · AssemblyAI ·
                                                                  Evolution · Pagar.me · Resend
```

### Camadas
- `src/app/(app)/**` — telas autenticadas (mundo clínico + prática).
- `src/app/(presence)/**` — Modo Presença (sessão ao vivo).
- `src/app/api/**` — Route Handlers (webhooks, IA, cron, SSE, sala).
- `src/server/services/**` — regras de negócio.
- `src/server/lib/**` — integrações e utilitários (anthropic, evolution, pagarme,
  email, crypto, aiGuard, sse, cron, env…).
- `src/server/db/**` — pool, migrations, runner.

## 2. Stack

> **Stack e versões completas: CLAUDE.md §3.** Aqui só os pontos com implicação de design.

- **Monolito Next.js 14 (App Router)** em build `standalone` — um único processo serve
  páginas (SSR) e APIs (Route Handlers + Server Actions).
- **Transcrição dual por canal:** Web Speech (psicólogo, no browser) + AssemblyAI
  streaming (paciente, áudio remoto do WebRTC) — ver §4.1.
- **Realtime sem servidor dedicado:** SSE para painel e signaling de vídeo; WebRTC P2P.

## 3. Modelo de dados

> **DDL completa: CLAUDE.md §11.** Aqui só o que importa para o design.

- Campos clínicos cifrados em repouso (AES-256): `sessoes.transcricao_texto`,
  `nota_clinica`, `resumo_ia` — ver §5.
- Grafo de temas: `palavras_chave` + `arestas_tema` (co-ocorrência por sessão),
  alimentado **apenas pelas falas do paciente** — ver §4.1.
- Estado conversacional do WhatsApp em `wa_conversas` (chave = telefone E.164).
- Migrations em `src/server/db/migrations/NNN_*.sql`, aplicadas por
  `src/server/db/migrate.mjs` (idempotente, controla em `_migrations`).

## 4. Fluxos-chave

### 4.1 Sessão ao vivo — transcrição dual e isolamento de falante
- O **psicólogo** é capturado pelo microfone local (Web Speech) → `who='psicologo'`.
- O **paciente** chega pelo **áudio remoto do WebRTC** → AssemblyAI → `who='paciente'`.
- **Isolamento (P7):** `getUserMedia` usa `echoCancellation/noiseSuppression/
  autoGainControl` para o mic do paciente não carregar a voz do psicólogo; como
  rede de segurança, um turno do paciente que seja cópia (similaridade Jaccard ≥ 0.7)
  de fala recente do psicólogo é **descartado**.
- **Análise paciente-only:** Temas ao vivo, Observação ao vivo e a extração
  persistida de temas usam apenas falas do paciente (`who='paciente'` / linhas `C:`).
  Resumo, risco e marcação usam o diálogo completo (precisam do contexto).

### 4.2 Pagamento confirma agendamento (P4)
Psicólogo agenda → WhatsApp pergunta método → Pagar.me gera cobrança → webhook
`order.paid` → `marcarPagamentoConfirmado` move a sessão para `confirmada`, publica
SSE e confirma ao paciente por WhatsApp/email.

### 4.3 Realtime
- **SSE** `/api/eventos` (painel) e `/api/sala/[token]/eventos` (signaling de vídeo):
  cada conexão limpa heartbeat + subscription no `cancel()`/`abort` para evitar
  vazamento e `ERR_INVALID_STATE`.

## 5. Segurança e compliance

- **AES-256-GCM** (`src/server/lib/crypto.ts`, formato `v1:iv:ct:tag`) para campos
  clínicos. **Trocar `ENCRYPTION_KEY` torna dados ilegíveis** — não rotacionar sem
  migração.
- **aiGuard** (`src/server/lib/aiGuard.ts`): valida e sanitiza saída da IA; bloqueia
  assinatura com termos proibidos. `CLINICAL_VOICE` prefixado em todo prompt.
- Áudio descartado após transcrição; consentimento auditado.
- Auth por sessão JWT; middleware protege `(app)` e `(presence)`.

## 6. Integrações externas

| Serviço | Uso | Notas |
|---------|-----|-------|
| Anthropic | resumos, temas, observação, chat | sem streaming/prompt-caching (ver tasks) |
| AssemblyAI | transcrição do paciente | token efêmero via `/api/transcribe/token` |
| Evolution v2 | WhatsApp | payload `{ number, text }`; instância conectada |
| Pagar.me | cobrança/reembolso | webhook **sem validação de assinatura** (ver tasks) |
| Resend | email | domínio verificado (`automaxia.com.br`) |
| WebRTC | vídeo P2P | só STUN público; **falta TURN** (ver tasks) |

## 7. Infraestrutura e deploy

- **Imagem** multi-stage (`Dockerfile`), Next standalone, usuário não-root.
- **Kubernetes** (namespace `aurencare`):
  - 1 Deployment (`aurencare-web`) servindo `app.` e `api.aurencare.ia.br` /
    `aurencare.automaxia.com.br`.
  - `aurencare-api` mantido apenas como **Ingress** apontando ao mesmo Service.
  - Secret `aurencare-secrets` (envs); pull secret `automaxia-secreto-docker`.
- **Migrations**: Job `k8s/migrate-job.yaml` reaproveita a imagem e roda
  `node src/server/db/migrate.mjs` (não usa `tsx` — incompleto no runtime por causa
  do `COPY` seletivo do `node_modules`).
- **Banco/cache no cluster**: `postgres-service.postgresql…:5432`,
  `redis.database…:6379`, Evolution `evolution-api-service.evolution…:8080`.
- **TLS**: cert-manager no origin + Cloudflare em **Full (strict)**.

## 8. Decisões de design (resumo)

- **D1 Monolito, 1 pod.** Frontend+API no mesmo app; rodar dois pods duplicaria o
  cron in-process (lembretes WhatsApp em dobro).
- **D2 `migrate.mjs` em JS puro.** Evita a fragilidade do `tsx` na imagem.
- **D3 Análise paciente-only (P7).** Isola a fala do paciente para temas/observação.
- **D4 AEC + dedup como defesa em profundidade** contra eco entre os falantes.
- **D5 Cron in-process hoje**; migrar para CronJob/fila é backlog.
