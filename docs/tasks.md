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

## Pendências — configuração para ligar a cobrança

> Todas são **configuração**, não código. Comandos em [INFRA.md](./INFRA.md).

- ⏳ **P0** `PAGARME_WEBHOOK_SECRET` real no cluster. Hoje é `change-me`: o webhook
  é fail-closed em produção e responde **503** — ou seja, **nenhuma sessão seria
  confirmada** (viola P4). Cadastrar também a URL no painel Pagar.me:
  `https://app.audere.ia.br/api/webhooks/pagarme`.
- ⏳ **P0** `PAGARME_RECIPIENT_PLATAFORMA` — recipient da conta da Audere, destino
  da comissão. Sem ele a cobrança sai **sem split** (valor inteiro na conta-mãe).
- ⏳ **P1** Chaves `live`: `PAGARME_API_KEY` (`sk_live`) no secret e
  `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` (`pk_live`) **no build da imagem** (build-time).
- ⏳ **P1** Validar o split em **sandbox**, sobretudo em `payment_method:
  'checkout'` (cartão). A montagem das fatias tem teste (`npm run test:split`);
  a aceitação pela API, não.
- ⏳ **P1** `ASSEMBLYAI_API_KEY` no cluster — sem ela não há transcrição do paciente.
- ⏳ **P2** Trocar `BETA_LIBERADO` para `false` em `planos.ts` quando tudo acima
  estiver pronto.

## Pendências — segurança

- ⏳ **P0** Confirmar que `ENCRYPTION_KEY` e `NEXTAUTH_SECRET` são valores **reais
  e definitivos** (trocar `ENCRYPTION_KEY` torna dados clínicos ilegíveis).
- ⏳ **P0** `CRON_SECRET` no cluster. Sem ele, `/api/cron/recalcular-temas` está
  fora do middleware de auth e **aceita qualquer chamada** — um POST anônimo
  dispara o recálculo de todos os pacientes (a operação mais cara do sistema).
- ⏳ **P0** `EVOLUTION_WEBHOOK_TOKEN` para ativar a validação do webhook da Evolution.
- 🔄 **P0** Rotacionar credenciais expostas no histórico do git. ✅ Postgres
  rotacionado; ✅ `.env.example` só com placeholders e `local.yaml` no `.gitignore`.
  ⏳ falta: Resend, AssemblyAI, e decidir sobre a Evolution API key (rotacionar =
  recriar instância → reescanear QR).

## Pendências — operação/robustez

- ⏳ **P1** Subir o **coturn** e definir `TURN_URLS` + `TURN_STATIC_AUTH_SECRET`.
  O código já está pronto (`lib/turn.ts`, `/api/ice`); hoje só há STUN, então
  chamadas caem atrás de NAT restritivo/4G.
- ⏳ **P1** Migrar cron in-process (`node-cron`) para **CronJob do k8s** ou fila
  (evita lembrete duplicado se houver mais de um pod).
- ⏳ **P1** **Recalcular Temas** dos pacientes com grafo antigo. Com o incremental,
  usar `?forcar=1` — sem isso os snapshots válidos são reaproveitados.
- ⏳ **P2** Deduplicação real de webhook (hoje a única guarda é o early-return de
  `pagamentoStatus === 'pago'`).
- ⏳ **P2** Dica de **"use fones de ouvido"** na tela da sala (reduz eco na origem).
- ⏳ **P2** `npm install` local desatualizado: `@excalidraw/excalidraw`, `unpdf` e
  `mammoth` estão no `package.json` mas não instalados — 4 erros no `tsc --noEmit`.

## Pendências — limpeza e coerência

- ⏳ **P2** `PAGARME_ENCRYPTION_KEY` é **código morto** (era da API v4; a v5 usa
  `appId` com `pk_`). Declarada em `.env.local`, `CLAUDE.md` e no secret de
  exemplo, lida em lugar nenhum — remover das três.
- ⏳ **P2** `PLACEHOLDER_HINTS` (`env.ts`) não cobre `sk_live_...`, `pk_live_...`
  nem `<webhook-secret-...>` — justamente os placeholders do próprio
  `.env.example`. Quem copiar o exemplo cru fica com `integrationStatus.pagarme
  = true` e chamadas reais dando 401, em vez de cair em mock.
- ⏳ **P2** Rotas `/mock/qr/*` e `/mock/checkout/*` não existem — em modo mock o
  WhatsApp envia link quebrado.
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
