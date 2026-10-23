# tasks.md — Tarefas e Backlog · Audere

> Acompanhamento de trabalho. Requisitos em [spec.md](./spec.md); design em [sdd.md](./sdd.md).
> Pendências de infra/operação (com comandos) em [INFRA.md](./INFRA.md).
> Última atualização: 23/10/2026.

Legenda status: ✅ concluído · 🔄 em andamento · ⏳ pendente · 🔮 futuro
Legenda prioridade: **P0** crítico (segurança/risco) · **P1** importante · **P2** desejável

---

## Concluído (em produção)

- ✅ Deploy no Kubernetes — monolito em 1 pod (`aurencare-web`), Ingress dos dois hosts.
- ✅ **CI/CD** — push em `main` dispara build → migrate → rollout (GitHub Actions).
  O secret `KUBE_CONFIG` expirou em ago/2026 **e de novo em 23/10/2026** e
  derrubou a esteira (falha na etapa de migration, com o build passando —
  parecia publicado sem estar); renovado nas duas vezes. Ver INFRA.md.
- ✅ Job de migrations (`migrate.mjs` em JS puro) — **51 migrations** aplicadas.
- ✅ **WhatsApp Cloud API (Meta)** em produção desde 11/09/2026 — número próprio
  +55 61 94758-1770, 17 templates aprovados; Evolution vira fallback
  (`WHATSAPP_PROVIDER`). Ver INFRA.md §4b.
- ✅ **TURN da Cloudflare** no código + medição de qualidade da chamada
  (`chamadas_qualidade`, migration 050) — out/2026. ⏳ Faltam as envs
  `CLOUDFLARE_TURN_*` no cluster; até lá, coturn.
- ✅ **Cortesia inativa volta pro Free** — cron diário 04h10: conta de cortesia
  sem acesso há 15 dias é rebaixada (out/2026).
- ✅ Desfoque de fundo do vídeo **removido** (qualidade ruim do recorte).
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
- ✅ **Split Pagar.me** — 2,5% da plataforma, psicólogo recebe líquido; taxa administrativa
  gravada por sessão e refletida no Financeiro e na visão contábil.
- ✅ Landing `/lancamento` (redesign v2, hero 3D) — acesso antecipado REMOVIDO
  em ago/2026; a seção `#acesso` virou a vitrine de planos. O backend de lista
  de espera segue existindo (admin → leads), só não é mais oferecido na landing.
- ✅ **Vitrine pública `/precos`** + fluxo vitrine → cadastro → checkout.
- ✅ **Cortesia do beta** (migration 047): contas existentes = Essencial por 1
  ano, vencimento aplicado em `obterAssinatura`. Excluídas das métricas de
  pagante/MRR no `/admin` — cortesia não é receita.

## Pagar.me — estado (23/10/2026)

> 💳 **Em live.** Chave secreta live no cluster desde 04/09/2026; chave pública
> live no build desde 23/10/2026 — antes disso o checkout da assinatura ficava
> em "modo demonstração" e ninguém conseguia assinar. `BETA_LIBERADO = false`.
> **Assinatura** cobra de verdade (sem split). **Sessão com split** segue
> bloqueada: a conta live não pode criar recebedores (ver abaixo).

### ✅ Fluxo de cobrança validado ponta a ponta
Verificado em produção: cobrança PIX criada → QR gerado → Simulator paga →
Pagar.me dispara `order.paid` → webhook **autenticado** → evento roteado para
`marcarPagamentoConfirmado`. Tudo em **menos de 10 segundos**. Numa sessão real
é aí que ela vira `confirmada`, com SSE + WhatsApp + email.

Seis defeitos estavam somados nesse caminho — todos corrigidos:

| # | Defeito | Correção |
|---|---|---|
| 1 | PIX sem `customer.document` → charge reprovada, order sem QR | envia CPF de `pacientes.dados_cadastro.cpf` |
| 2 | `PAGARME_API_KEY` era o placeholder `sk_test_...` → produção em **modo mock** (link `/mock/qr` = 404) | chave real no cluster + `PLACEHOLDER_HINTS` ampliada + rota `/mock` criada |
| 3 | URL do webhook em `aurencare.automaxia.com.br` — domínio **morto** (curl → 000) | `app.audere.ia.br` |
| 4 | Código validava **HMAC**; a Pagar.me usa **Basic Auth** — nenhum secret jamais casaria | `verifyBasicAuth` + `PAGARME_WEBHOOK_USER`/`_SECRET` |
| 5 | Webhook com **1** tentativa — instabilidade perdia a confirmação | 3 tentativas |
| 6 | PIX com **Modelo de negócio = PSP** em conta de teste | trocado para **Simulator** |

- ✅ **Cartão** (crédito/débito) gera checkout normalmente.
- ✅ **Onboarding de recebimento** corrigido (endereço PF/PJ + sócio) — payload
  passa por toda a validação da API; só falta a habilitação abaixo.

### Recebedores
- ✅ **Sandbox** cria recebedores normalmente (verificado 23/10/2026 com payload
  completo). ⚠️ Payload vazio dá 422 e **não prova** liberação — a validação de
  estrutura vem antes do gate de permissão.
- ✅ `PAGARME_RECIPIENT_PLATAFORMA` no secret (`re_cmq56ad0…`, conta live).
- ✅ **Split ativado** no painel da conta live (Funcionalidades › Split, 23/10/2026).

### ⏳ O que resta
- **P0 — Conta live sem permissão de criar recebedores.** Depois de ativar o
  split, `POST /recipients` passou de `412 split settings enabled` para
  `412 action_forbidden — This company it not allowed to create a recipient`.
  Pedido aberto no suporte da Pagar.me em 23/10/2026. Até liberar, nenhum
  psicólogo conclui o onboarding de recebimento e a taxa de 2,5% não sai.
  Probe para conferir em INFRA.md §2.
- **P1 — Testar assinatura real** em `/planos` (cartão próprio, cancelar depois).
- **P1 — PIX no live**: conferir "Modelo de negócio" = **PSP** em Meios de pagamento.
- **P0 — 5 psicólogos com recebedor SINTÉTICO.** O onboarding rodou enquanto a
  produção estava em modo mock (INFRA.md §1) e gravou `mock_rcp_*` em
  `psicologos.pagarme_recipient_id` — IDs que **não existem na Pagar.me**. Eles
  constavam como "recebimento configurado" e o dinheiro deles cairia na
  conta-mãe. Pior: assim que a env da plataforma existir, o split usaria esse ID
  e a **order inteira seria recusada** — a cobrança do paciente falharia.
  Código já protegido (`isRecipientMock`, ago/2026): esses cadastros contam como
  incompletos, a cobrança é bloqueada com motivo nomeado e a aba Recebimentos
  mostra um aviso pedindo para refazer. **Falta os 5 refazerem o onboarding.**

### 🐞 PIX — o que estava escondido atrás do bloqueio
- **Só 3 de 34 pacientes ativos têm CPF** (verificado 18/08/2026). Como a
  Pagar.me exige `customer.document` no PIX, ~91% dos pacientes hoje respondem
  "PIX" no WhatsApp e são empurrados para cartão. Corrigido: campo **CPF no
  cadastro do paciente** (`/pacientes/novo`), validação por dígito verificador
  ao salvar (fonte única em `src/lib/documento.ts`) e motivo acionável no
  pós-sessão em vez de "falhou · tentar de novo".
- ✅ **PIX validado direto na API** (18/08/2026): order criada → charge
  `waiting_payment` → `qr_code` + `qr_code_url` presentes. O "Modelo de negócio
  = Simulator" está correto no sandbox.
- ✅ **Chave do cluster conferida** — `sk_test_` real (não placeholder), válida,
  e da **mesma conta** da chave local (order criada com uma é legível pela outra).
- ✅ **`npm install` em dia** — `@excalidraw/excalidraw`, `unpdf` e `mammoth`
  instalados; `tsc --noEmit` e `next build` limpos (era P2 aberto).

### Go-live (sandbox → produção)
- ✅ `PAGARME_API_KEY` → chave live no secret (04/09/2026; prefixo `sk_`, sem `_live_`).
- ✅ `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` → chave live **no build da imagem**, via
  secret do GitHub Actions (23/10/2026). Build-time: só no secret de runtime
  **não** funciona.
- ⏳ PIX: **Modelo de negócio = PSP** no live (o inverso do sandbox) — conferir.
- ✅ Webhook live (URL + Basic Auth) e recipient da plataforma no live.
- ⏳ ⚠️ **Recipients são por ambiente**: psicólogos que fizeram o onboarding em
  sandbox precisam refazê-lo no live (o código já invalida recebedor de outro
  ambiente — migration 048).
- ✅ `BETA_LIBERADO = false` em `planos.ts` (ago/2026).

## Pendências — segurança

- ✅ `CRON_SECRET` **definido no cluster** (verificado ago/2026) — a rota
  `/api/cron/recalcular-temas` exige `Bearer`, não está aberta.
- ✅ `EVOLUTION_WEBHOOK_TOKEN` **definido** — validação do webhook da Evolution ativa.
- ✅ `ENCRYPTION_KEY` (64 chars) e `OPENAI_API_KEY` presentes e reais no cluster.
- ⏳ **P0** Confirmar que `ENCRYPTION_KEY` e `NEXTAUTH_SECRET` são os valores
  **definitivos** (trocar `ENCRYPTION_KEY` depois torna dados clínicos ilegíveis).
- 🔄 **P0** Rotacionar credenciais expostas no histórico do git. ✅ Postgres
  rotacionado; ✅ `.env.example` só com placeholders e `local.yaml` no `.gitignore`.
  ⏳ falta: Resend, AssemblyAI, PAT do GitHub embutido no `git remote`, e decidir
  sobre a Evolution API key (rotacionar = recriar instância → reescanear QR).

## Pendências — operação/robustez

- ⏳ **P1** Migrar cron in-process (`node-cron`) para **CronJob do k8s** ou fila
  (evita lembrete duplicado se houver mais de um pod).
- ⏳ **P1** kubeconfig do Rancher **sem expiração** (ou lembrete antes de vencer) —
  já derrubou o deploy duas vezes.
- ⏳ **P2** Aplicar `CLOUDFLARE_TURN_KEY_ID`/`_API_TOKEN` no secret (TURN no Brasil).
- ⏳ **P2** Espelhar `TURN_*` no `.env.local` (o dev local roda **só com STUN**;
  em produção o TURN está ativo). Não bloqueia nada — só reduz a fidelidade do
  teste de vídeo local.
- ⏳ **P1** **Recalcular Temas** dos pacientes com grafo antigo. Com o incremental,
  usar `?forcar=1` — sem isso os snapshots válidos são reaproveitados.
- ⏳ **P2** Deduplicação real de webhook (hoje a única guarda é o early-return de
  `pagamentoStatus === 'pago'`).
- ⏳ **P2** Dica de **"use fones de ouvido"** na tela da sala (reduz eco na origem).

## Pendências — limpeza e coerência

- ✅ `PAGARME_ENCRYPTION_KEY` removida de `CLAUDE.md` e do secret de exemplo
  (era da API v4; a v5 usa `appId` com `pk_` — nunca foi lida pelo código).
  ⏳ Ainda presente no secret **do cluster** (23/10/2026) — inofensiva, remover.
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
