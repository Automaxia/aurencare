# tasks.md — Tarefas e Backlog · Auren Care

> Acompanhamento de trabalho. Requisitos em [spec.md](./spec.md); design em [sdd.md](./sdd.md).
> Última atualização: junho 2026.

Legenda status: ✅ concluído · 🔄 em andamento · ⏳ pendente · 🔮 futuro
Legenda prioridade: **P0** crítico (segurança/risco) · **P1** importante · **P2** desejável

---

## Concluído (em produção)

- ✅ Deploy no Kubernetes — monolito em 1 pod (`aurencare-web`), Ingress dos dois hosts.
- ✅ Job de migrations (`migrate.mjs` em JS puro) + 17 migrations aplicadas.
- ✅ Banco/role `aurencare` criados no Postgres do cluster.
- ✅ Domínio de produção `aurencare.automaxia.com.br` + TLS (Cloudflare Full strict).
- ✅ WhatsApp funcionando — correção do payload Evolution **v2** (`{ number, text }`).
- ✅ Email funcionando — Resend configurado + domínio `automaxia.com.br` verificado.
- ✅ IA em produção — `ANTHROPIC_API_KEY` real no secret do cluster.
- ✅ SSE robusto — limpeza de heartbeat/subscription no disconnect (fim do `ERR_INVALID_STATE`).
- ✅ Modo Presença — isolamento de falante (AEC + descarte de eco) e **análise
  paciente-only** (temas ao vivo, observação ao vivo, temas persistidos).

## Pendências — segurança

- 🔄 **P0** **Verificação de webhooks implementada** (Pagar.me: HMAC `X-Hub-Signature`;
  Evolution: token compartilhado `x-webhook-token`/`?token=`). **Degradação segura:**
  só *exige* quando o segredo está configurado. ⏳ **Falta ativar:** definir
  `PAGARME_WEBHOOK_SECRET` e `EVOLUTION_WEBHOOK_TOKEN` reais no secret do cluster e
  apontar o token na config do webhook da Evolution.
- ⏳ **P0** Definir `ENCRYPTION_KEY` real **antes de qualquer dado clínico real**
  (trocar depois torna dados ilegíveis). Idem `NEXTAUTH_SECRET`.
- 🔄 **P0** **Rotacionar credenciais expostas no histórico do git.** ✅ senha do Postgres
  rotacionada (valor antigo morto); ✅ `.env.example` agora só com placeholders + `local.yaml`
  no `.gitignore`. ⏳ **falta:** Resend (gerar key nova no painel + revogar antiga) e decidir
  sobre a Evolution API key (rotacionar = recriar instância → reescanear QR).
- ⏳ **P1** Preencher demais placeholders no secret: `PAGARME_*`, `ASSEMBLYAI_API_KEY`.

## Pendências — operação/robustez

- ⏳ **P1** **Recalcular Temas** dos pacientes existentes (dados antigos extraídos com
  as duas falas; recálculo aplica o paciente-only). Botão em `/pacientes/[id]/temas`.
- ⏳ **P1** Migrar cron in-process (`node-cron`) para **CronJob do k8s** ou fila (evita
  lembrete duplicado se houver mais de um pod) + definir **`CRON_SECRET`** no cluster.
- ⏳ **P2** **Servidor TURN** para WebRTC (hoje só STUN público — chamadas podem falhar
  atrás de NAT restritivo).
- ⏳ **P2** Dica de **"use fones de ouvido"** na tela da sala (reduz eco na origem).

## Pendências — IA/custo

- ⏳ **P2** **Prompt caching** da Anthropic (reduz custo/latência no chat longitudinal).
- ⏳ **P2** **Streaming** das respostas de IA.
- ⏳ **P2** Auditoria/log quando o `aiGuard` rejeita texto.
- ⏳ **P2** Corrigir `classificarTom` (envia `who:'paciente'` fixo também para turnos
  do psicólogo).

## Futuro (fora do MVP)

- 🔮 Modo supervisor (Fase 3).
- 🔮 Agendamento inbound pelo paciente via WhatsApp (TODO `WA.3`).
- 🔮 UI de escolha de parcelas (1–6x) no fluxo de cartão.
- 🔮 Fluxo manual de disputa para sessões em estado `contestado`.
- 🔮 App mobile.
