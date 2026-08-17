# INFRA.md — Pendências de infraestrutura · Audere

> **Fonte única.** O `INFRA.md` da raiz virou um ponteiro para este arquivo —
> as duas cópias haviam divergido (a da raiz tinha o TURN concluído, esta tinha
> o login com Google; nenhuma era superconjunto da outra).
>
> App: monolito Next.js, **1 pod** `aurencare-web` · namespace `aurencare` · secret
> `aurencare-secrets`. **Deploy automático no push para `main`** (GitHub Actions:
> build → migrate → rollout). As migrations rodam sozinhas na esteira.
>
> Marque `[x]` conforme concluir. Contexto técnico em [sdd.md](./sdd.md); backlog
> completo em [tasks.md](./tasks.md).

---

> ℹ️ **Estado do secret verificado em ago/2026** (`kubectl get secret
> aurencare-secrets -n aurencare`). Já definidos e reais: `ASSEMBLYAI_API_KEY`,
> `CRON_SECRET`, `EVOLUTION_WEBHOOK_TOKEN`, `OPENAI_API_KEY`, `ENCRYPTION_KEY`,
> `TURN_URLS`. Pendentes: os dois itens da §1 abaixo.

## 🔴 1. Agora — tirar o Pagar.me do modo mock

`PAGARME_API_KEY` no cluster é o **placeholder literal** `sk_test_...` (11
chars). Como esse valor está em `PLACEHOLDER_HINTS` (`env.ts:7`),
`integrationStatus.pagarme` é `false` e **produção roda em modo mock**: toda
cobrança gera `mock_pix_…` com link `https://app.audere.ia.br/mock/qr/…png`,
rota que **não existe** — o paciente recebe 404.

- [ ] Definir a chave de teste real e reiniciar (só DEPOIS do deploy das
      correções de PIX — sem elas, sair do mock manda link vazio em vez de 404):
  ```bash
  kubectl patch secret aurencare-secrets -n aurencare --type merge \
    -p '{"stringData":{"PAGARME_API_KEY":"sk_test_<real>"}}'
  kubectl rollout restart deploy/aurencare-web -n aurencare
  kubectl rollout status  deploy/aurencare-web -n aurencare
  ```
- [x] `ASSEMBLYAI_API_KEY` definida — transcrição do paciente, fallback do tablet
      e multilíngue (PT/EN) destravados.
- [ ] **Rotacionar** a key da AssemblyAI (foi compartilhada em texto).

## 🔴 2. Agora — destravar a confirmação de pagamento

O webhook da Pagar.me é **fail-closed em produção**: sem `PAGARME_WEBHOOK_SECRET`
ele responde **503** e **nenhuma sessão é confirmada** (viola a premissa P4). O
gate é `NODE_ENV=production`, **não** o tipo da chave — vale igual em sandbox.

- [ ] Gerar o secret no painel Pagar.me (**ambiente sandbox**, ver §3) e definir:
  ```bash
  kubectl patch secret aurencare-secrets -n aurencare --type merge \
    -p '{"stringData":{"PAGARME_WEBHOOK_SECRET":"<secret>"}}'
  ```
- [ ] Cadastrar o webhook no painel → `https://app.audere.ia.br/api/webhooks/pagarme`
      (eventos: `order.paid`, `order.canceled`, `charge.payment_failed`,
      `subscription.charged/canceled`, `invoice.paid`).
- [ ] **`PAGARME_RECIPIENT_PLATAFORMA`** — recipient da conta da Audere (sandbox),
      destino da comissão de 2,5% no split. Sem ele a cobrança sai **sem split**
      e o valor inteiro fica na conta-mãe, em vez de ir para o psicólogo.
- [ ] **`CRON_SECRET`** — sem ele, `/api/cron/recalcular-temas` fica fora do
      middleware de auth e aceita **qualquer** chamada; um POST anônimo dispara o
      recálculo de todos os pacientes (a operação de IA mais cara do sistema).

## 🟢 3. Confiabilidade do vídeo — servidor TURN (#11) — ✅ ATIVO
Chamadas atrás de NAT/4G agora têm relay TURN (antes só STUN).

- [x] **Código** — app lê TURN do cluster: `src/server/lib/turn.ts` (credenciais
      **efêmeras** HMAC, modo coturn `use-auth-secret`), rota pública `/api/ice`
      (liberada no middleware), `useWebRTC` busca de lá (fallback STUN-only).
- [x] **coturn no cluster** — `k8s/coturn.yaml` aplicado, pod Running no nó
      `84.247.138.18` (hostNetwork). Secret `coturn-auth` + `aurencare-secrets`
      com `TURN_STATIC_AUTH_SECRET`/`TURN_URLS`/`TURN_TTL`.
- [x] **DNS** — `turn.audere.ia.br` → `84.247.138.18` (resolve no 8.8.8.8/1.1.1.1).
- [x] **Firewall** — `3478/udp` e `3478/tcp` abertos + relay `49160-49200/udp`.
- [x] **Validado end-to-end** (jun/2026) — TURN Allocate real com credencial
      efêmera do `/api/ice`: `realm=audere.ia.br`, relay alocado em `:49165`.
      Auth HMAC OK, relay OK.
- [ ] *(Opcional)* `turns:` (TLS:5349) — só após montar cert válido em
      `/etc/coturn/certs` e descomentar `cert`/`pkey` no ConfigMap do `coturn.yaml`.
      Útil em redes que bloqueiam tudo menos 443/TLS; `3478 udp/tcp` cobre o resto.
- [ ] *(Opcional)* Espelhar `TURN_*` no `.env.local` — dev local roda STUN-only.

## 🟡 4. Cobrança — **seguimos em SANDBOX durante o beta**

Hoje: `BETA_LIBERADO=true` (acesso liberado, sem cobrança) e chaves
`sk_test_`/`pk_test_`. Nenhuma cobrança é real — dá para exercitar o fluxo
inteiro sem risco. **A troca para `live` é um passo deliberado do go-live.**

Quando for ligar de verdade:

- [ ] `PAGARME_API_KEY` → `sk_live` no secret.
- [ ] `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` → `pk_live` — ⚠️ **é build-time**: tem que
      entrar no **build da imagem** (`--build-arg` no `build-push.sh` ou env do
      job de build), **não** só no secret de runtime.
- [ ] Recriar no ambiente live: webhook (URL + secret) e recipient da plataforma.
- [ ] ⚠️ **Recipients são por ambiente**: os psicólogos que fizerem o onboarding
      de recebimento em sandbox terão de refazê-lo (ou ser migrados) no live.
      Pesar isso antes de abrir o beta para muita gente com KYC completo.
- [ ] No código: trocar `BETA_LIBERADO` para `false` em `src/server/lib/planos.ts`
      + redeploy.

## 🔒 5. Segurança / hardening
- [ ] Confirmar que `ENCRYPTION_KEY` e `NEXTAUTH_SECRET` são valores **reais e
      definitivos** (trocar `ENCRYPTION_KEY` depois torna dados clínicos ilegíveis).
- [ ] `EVOLUTION_WEBHOOK_TOKEN` definido → ativa a validação do webhook da
      Evolution (hoje degrada sem validar).
- [ ] Rotacionar credenciais já expostas no histórico: AssemblyAI (agora), Resend,
      e decidir sobre a Evolution API key (rotacionar = recriar instância → QR).
- [ ] **ZDR + DPA com a OpenAI** — ela é o provedor primário de IA, então dado
      clínico trafega para lá na maioria das chamadas. A promessa "zero data
      training" exibida na UI depende desse contrato.

## ⚙️ 6. Operação
- [ ] Migrar o cron in-process (node-cron) para **CronJob do k8s** (evita lembrete
      duplicado se subir mais de 1 pod). O `CRON_SECRET` já está na §2.

## 🔵 7. Login com Google (adiado — precisa de credenciais OAuth)
Recuperação de senha já está no ar. O login/cadastro com Google fica pra ligar
quando houver as credenciais (o dev faz o código; estas etapas são suas):

- [ ] No **Google Cloud Console** → APIs & Services → Credentials → criar
      **OAuth client ID** (tipo *Web application*).
- [ ] Authorized redirect URI: `https://app.audere.ia.br/api/auth/callback/google`
- [ ] Definir no secret e reiniciar:
  ```bash
  kubectl patch secret aurencare-secrets -n aurencare --type merge \
    -p '{"stringData":{"GOOGLE_CLIENT_ID":"<id>","GOOGLE_CLIENT_SECRET":"<secret>"}}'
  ```
- [ ] Confirmar `NEXTAUTH_URL=https://app.audere.ia.br` (o callback do Google usa essa base).
- [ ] Decisão já tomada: contas de mesmo email são **vinculadas** (Google = outra
      forma de entrar na conta existente).

---

## 🐞 Diagnóstico (não é config — precisa reproduzir)
- [ ] **#8 confirmação do paciente falhando:** reproduzir e enviar o log
  ```bash
  kubectl logs deploy/aurencare-web -n aurencare --tail=200 | grep confirmacao.action
  ```
- [ ] **Fallback de custo de IA:** se aparecer, a OpenAI está fora e o tier `fast`
      está rodando ~8× mais caro no Anthropic
  ```bash
  kubectl logs deploy/aurencare-web -n aurencare --tail=500 | grep "ALERTA CUSTO"
  ```

---

*Atualizado: ago/2026. Itens de código associados ficam com o time de dev.*
