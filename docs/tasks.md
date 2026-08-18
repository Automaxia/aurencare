# tasks.md — Tarefas e Backlog · Audere

> Acompanhamento de trabalho. Requisitos em [spec.md](./spec.md); design em [sdd.md](./sdd.md).
> Pendências de infra/operação (com comandos) em [INFRA.md](./INFRA.md).
> Última atualização: agosto 2026.

Legenda status: ✅ concluído · 🔄 em andamento · ⏳ pendente · 🔮 futuro
Legenda prioridade: **P0** crítico (segurança/risco) · **P1** importante · **P2** desejável

---

## Concluído (em produção)

- ✅ Deploy no Kubernetes — monolito em 1 pod (`aurencare-web`), Ingress dos dois hosts.
- ✅ **CI/CD** — push em `main` dispara build → migrate → rollout (GitHub Actions).
- ✅ Job de migrations (`migrate.mjs` em JS puro) — **44 migrations** aplicadas.
- ✅ Domínio de produção `app.audere.ia.br` + TLS (Cloudflare Full strict).
- ✅ WhatsApp — payload Evolution **v2**, 7 fluxos + inbox conversacional + voz.
- ✅ Email — Resend + domínio `automaxia.com.br` verificado; recuperação de senha.
- ✅ SSE robusto — limpeza de heartbeat/subscription no disconnect.
- ✅ Modo Presença — isolamento de falante e **análise paciente-only**.
- ✅ **Palco compartilhado** — objetivos, quadro branco (Excalidraw), checagem de
  humor interativa e grafo de temas, em cards móveis/redimensionáveis.
- ✅ **Vídeo** — reconexão automática, memória de câmera/mic, `/api/ice` com
  STUN + TURN (credencial efêmera HMAC).
- ✅ **TURN em produção** — coturn no cluster (`k8s/coturn.yaml`, hostNetwork),
  DNS `turn.audere.ia.br`, firewall `3478 udp/tcp` + relay `49160-49200/udp`,
  **validado end-to-end** (Allocate real com credencial efêmera do `/api/ice`).
  Opcional pendente: `turns:` em TLS/5349 para redes que só liberam 443.
- ✅ **Laudo híbrido** — resumo curto automático (`fast`) + laudo formal CFP sob
  demanda (`strong`), idempotente.
- ✅ **Sessão interrompida** + exclusão de sessão vazia + cron `destravar-sessoes`.
- ✅ **Importar sessões anteriores** (texto/PDF/DOCX) como histórico.
- ✅ **Papéis e área admin** — `role`, `/admin` com psicólogos, custos, leads e
  diagnóstico do WhatsApp. (Era "futuro" no backlog antigo.)
- ✅ **Instrumentação de custo de IA** — `api_custos` com atribuição por
  psicólogo/paciente/sessão/natureza + latência; painel `/admin/custos`.
- ✅ **Roteamento OpenAI-primário** com fallback alertado, timeout adaptativo e
  health-check no boot (fechou o vazamento de ~8× do tier `fast`).
- ✅ **Curva de custo do grafo medida** — O(n) linear, ~R$ 0,0055/sessão.
- ✅ **Recálculo incremental do grafo** — reaproveita snapshot válido; recalcular
  sem mudanças custa 0 chamadas de IA.
- ✅ **Split Pagar.me** — 2,5% da plataforma, psicólogo recebe líquido; comissão
  gravada por sessão e refletida no Financeiro e na visão contábil.
- ✅ Landing `/lancamento` (redesign v2, hero 3D) + lista de espera.

## Pendências — Pagar.me

> Todas são **configuração**, não código. Comandos em [INFRA.md](./INFRA.md).

> 🧪 **Decisão: seguimos em SANDBOX (`sk_test_`/`pk_test_`) durante o beta.**
> Nenhuma cobrança é real, então o fluxo inteiro pode ser exercitado sem risco.
> A troca para `live` é um passo deliberado do go-live, não uma pendência
> esquecida. **Enquanto isso, todo valor abaixo deve ser o do ambiente sandbox.**

### Agora (para exercitar o fluxo em sandbox)
- ⏳ **P0** `PAGARME_WEBHOOK_SECRET` **do painel sandbox** no cluster. Hoje é
  `change-me`: como produção roda com `NODE_ENV=production`, o webhook é
  fail-closed e responde **503** — **nenhuma sessão é confirmada** (viola P4),
  mesmo em sandbox. Cadastrar também a URL no painel:
  `https://app.audere.ia.br/api/webhooks/pagarme`.
- ⏳ **P0** `PAGARME_RECIPIENT_PLATAFORMA` — recipient **da conta sandbox** da
  Audere, destino da comissão. Sem ele a cobrança sai **sem split** (valor
  inteiro na conta-mãe).
- ⏳ **P0** **`PAGARME_API_KEY` no cluster é o PLACEHOLDER `sk_test_...`** (11
  chars) → `integrationStatus.pagarme = false` → **produção roda em modo mock**:
  toda cobrança gera link `/mock/qr/…`, rota que não existe (404 pro paciente).
  Trocar pela chave de teste real assim que o deploy das correções subir.
- ✅ `ASSEMBLYAI_API_KEY` **definida no cluster** (verificado ago/2026).
- ⏳ **P1** Validar o split em sandbox, sobretudo em `payment_method: 'checkout'`
  (cartão). A montagem das fatias tem teste (`npm run test:split`); a aceitação
  pela API, não — depende da habilitação de recebedores.

### Bloqueios do lado da Pagar.me (não são código)
- ⏳ **P0** **PIX sem ambiente configurado no sandbox** — a charge é reprovada com
  `action_forbidden | Sem ambiente configurado para este tipo de transação`.
  Testado com duas chaves `sk_test_` diferentes, mesmo resultado. A configuração
  do painel (PIX ativo, modelo PSP) parece ter sido salva no ambiente de
  **Produção**; precisa ser refeita no ambiente de **Teste**.
- ⏳ **P0** **Recebedores/split não liberados na conta** —
  `action_forbidden | This company is not allowed to create a recipient`.
  Não é self-service: exige chamado à Pagar.me pedindo modelo marketplace com
  split por transação. Bloqueia o onboarding de recebimento e a comissão de 2,5%.
- ✅ **Cartão (crédito/débito) funciona** no sandbox — checkout testado, gera
  `payment_url` normalmente.

### No go-live (trocar de sandbox para produção)
- 🔮 `PAGARME_API_KEY` → `sk_live` no secret.
- 🔮 `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` → `pk_live` **no build da imagem**
  (é build-time; pôr só no secret de runtime **não** funciona).
- 🔮 Recriar no ambiente live: webhook (URL + secret) e recipient da plataforma.
  Os recipients dos psicólogos também são por ambiente — o onboarding precisa
  ser refeito, ou migrado, para as contas já cadastradas em sandbox.
- 🔮 Trocar `BETA_LIBERADO` para `false` em `planos.ts` + redeploy.

## Pendências — segurança

- ✅ `CRON_SECRET` **definido no cluster** (verificado ago/2026) — a rota
  `/api/cron/recalcular-temas` exige `Bearer`, não está aberta.
- ✅ `EVOLUTION_WEBHOOK_TOKEN` **definido** — validação do webhook da Evolution ativa.
- ✅ `ENCRYPTION_KEY` (64 chars) e `OPENAI_API_KEY` presentes e reais no cluster.
- ⏳ **P0** Confirmar que `ENCRYPTION_KEY` e `NEXTAUTH_SECRET` são os valores
  **definitivos** (trocar `ENCRYPTION_KEY` depois torna dados clínicos ilegíveis).
- 🔄 **P0** Rotacionar credenciais expostas no histórico do git. ✅ Postgres
  rotacionado; ✅ `.env.example` só com placeholders e `local.yaml` no `.gitignore`.
  ⏳ falta: Resend, AssemblyAI, e decidir sobre a Evolution API key (rotacionar =
  recriar instância → reescanear QR).

## Pendências — operação/robustez

- ⏳ **P1** Migrar cron in-process (`node-cron`) para **CronJob do k8s** ou fila
  (evita lembrete duplicado se houver mais de um pod).
- ⏳ **P2** Espelhar `TURN_*` no `.env.local` (o dev local roda **só com STUN**;
  em produção o TURN está ativo). Não bloqueia nada — só reduz a fidelidade do
  teste de vídeo local.
- ⏳ **P1** **Recalcular Temas** dos pacientes com grafo antigo. Com o incremental,
  usar `?forcar=1` — sem isso os snapshots válidos são reaproveitados.
- ⏳ **P2** Deduplicação real de webhook (hoje a única guarda é o early-return de
  `pagamentoStatus === 'pago'`).
- ⏳ **P2** Dica de **"use fones de ouvido"** na tela da sala (reduz eco na origem).
- ⏳ **P2** `npm install` local desatualizado: `@excalidraw/excalidraw`, `unpdf` e
  `mammoth` estão no `package.json` mas não instalados — 4 erros no `tsc --noEmit`.

## Pendências — limpeza e coerência

- ✅ `PAGARME_ENCRYPTION_KEY` removida de `CLAUDE.md` e do secret de exemplo
  (era da API v4; a v5 usa `appId` com `pk_` — nunca foi lida pelo código).
- ✅ `PLACEHOLDER_HINTS` (`env.ts`) ampliada — cobre `sk_live_...`, `pk_live_...`,
  `<...>` e afins. Antes, `sk_test_...` no secret de produção derrubava o app
  inteiro em modo mock, e um `.env.example` copiado cru daria 401 em vez de mock.
- ✅ Rota `/mock/[...slug]` criada (e liberada no middleware) — em modo mock o
  link enviado ao paciente explica que é demonstração, em vez de dar 404.
- ✅ `classificarTom` **já estava correto** — o client envia `who` por turno
  (`client.tsx:283`) e a rota respeita (`tom-turno/route.ts:43`).
- ⏳ **P2** Taxas Pagar.me hardcoded em `financeiro.ts` e `visaoContabil.ts`
  (duas cópias, estimadas) — idealmente vir da API ou ao menos ter fonte única.
- ⏳ **P2** Auditoria/log quando o `aiGuard` rejeita texto.
- ⏳ **P2** Corrigir `classificarTom` (envia `who:'paciente'` fixo também para
  turnos do psicólogo).
- ⏳ **P2** Rename de infra `aurencare` → `audere` (domínio, banco, namespace,
  imagem) — hoje só a camada user-facing é Audere.

## Pendências — IA/custo

- ⏳ **P2** Prompt caching da Anthropic no caminho de fallback.
- ⏳ **P2** Streaming das respostas de IA.
- ⏳ **P1** **ZDR + DPA com a OpenAI.** Com ela como primária, dado clínico
  trafega para lá na maioria das chamadas; a promessa "zero data training" exibida
  na UI depende desse contrato. Sem ele, inverter `PROVIDER_ORDER`.

## Futuro (fora do MVP)

- 🔮 Modo supervisor (Fase 3).
- 🔮 Agendamento inbound pelo paciente via WhatsApp (TODO `WA.3`).
- 🔮 Clínica/equipe — o gancho `organizacao_id` já existe no schema (migration 022),
  hoje sempre NULL. Plano em [`usuarios-papeis.md`](./usuarios-papeis.md).
- 🔮 UI de escolha de parcelas (1–6x) no fluxo de cartão.
- 🔮 Atualização de recipient e troca de cartão da assinatura (hoje só criação).
- 🔮 Fluxo manual de disputa para sessões em estado `contestado`.
- 🔮 App mobile.
