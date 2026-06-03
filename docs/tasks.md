# tasks.md — Tarefas e Backlog · Auren Care

> Acompanhamento de trabalho. Requisitos em [spec.md](./spec.md); design em [sdd.md](./sdd.md).
> Última atualização: junho 2026.

Legenda: ✅ concluído · 🔄 em andamento · ⏳ pendente · 🔮 futuro

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

## Pendências — segurança (prioridade alta)

- ⏳ **Validar assinatura dos webhooks** Pagar.me e Evolution (hoje aceitam qualquer POST).
  `PAGARME_WEBHOOK_SECRET` existe mas não é verificado.
- ⏳ **Rotacionar credenciais expostas no histórico do git** (Resend, Evolution,
  senha do Postgres do cluster) — entraram em commits anteriores do `.env.example`.
- ⏳ Definir valores reais ainda placeholder no secret: `ENCRYPTION_KEY` (⚠️ antes de
  qualquer dado clínico real), `NEXTAUTH_SECRET`, `PAGARME_*`, `ASSEMBLYAI_API_KEY`.

## Pendências — operação/robustez

- ⏳ **Recalcular Temas** dos pacientes existentes (dados antigos foram extraídos com
  as duas falas; recálculo aplica o paciente-only). Botão na tela `/pacientes/[id]/temas`.
- ⏳ **`CRON_SECRET`** no cluster, caso os endpoints `/api/cron/*` sejam acionados por
  scheduler externo.
- ⏳ Migrar cron in-process (`node-cron`) para **CronJob do k8s** ou fila (evita lembrete
  duplicado se um dia houver mais de um pod).
- ⏳ **Servidor TURN** para WebRTC (hoje só STUN público — chamadas podem falhar atrás
  de NAT restritivo).
- ⏳ Dica de **"use fones de ouvido"** na tela da sala (reduz eco na origem).

## Pendências — IA/custo

- ⏳ **Prompt caching** da Anthropic (reduz custo/latência no chat longitudinal).
- ⏳ **Streaming** das respostas de IA.
- ⏳ Auditoria/log quando o `aiGuard` rejeita texto.
- ⏳ Corrigir `classificarTom` (envia `who:'paciente'` fixo também para turnos do psicólogo).

## Futuro (fora do MVP)

- 🔮 Modo supervisor (Fase 3).
- 🔮 Agendamento inbound pelo paciente via WhatsApp (TODO `WA.3`).
- 🔮 UI de escolha de parcelas (1–6x) no fluxo de cartão.
- 🔮 Fluxo manual de disputa para sessões em estado `contestado`.
- 🔮 App mobile.
