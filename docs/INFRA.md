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
> `TURN_URLS`, `PAGARME_API_KEY`, `PAGARME_WEBHOOK_USER`/`_SECRET`.
> Pendente: `PAGARME_RECIPIENT_PLATAFORMA` (bloqueado pela Pagar.me, ver §4).

## 🟢 1. Pagar.me fora do modo mock — ✅ RESOLVIDO (ago/2026)

`PAGARME_API_KEY` no cluster era o **placeholder literal** `sk_test_...` (11
chars), que está em `PLACEHOLDER_HINTS` → `integrationStatus.pagarme = false` →
**produção rodava em modo mock**: toda cobrança virava link `/mock/qr/…`, rota
que não existia (404 no paciente).

- [x] Chave de teste real aplicada no secret e pod reiniciado.
- [x] Rota `/mock/[...slug]` criada — se o modo mock voltar a acontecer, o link
      explica que é demonstração em vez de dar 404.
- [x] `PLACEHOLDER_HINTS` ampliada para pegar `sk_live_...`, `pk_live_...`, `<...>`.
- [x] `ASSEMBLYAI_API_KEY` definida — transcrição do paciente, fallback do tablet
      e multilíngue (PT/EN) destravados.
- [ ] **Rotacionar** a key da AssemblyAI (foi compartilhada em texto).

## 🟢 2. Confirmação de pagamento — ✅ RESOLVIDO (ago/2026)

O webhook estava quebrado por **três** causas somadas, não uma:

- [x] **URL apontava para domínio morto** — estava `aurencare.automaxia.com.br`
      (curl → 000). Corrigida para `https://app.audere.ia.br/api/webhooks/pagarme`.
- [x] **Mecanismo errado no código** — a Pagar.me v5 autentica webhook por
      **HTTP Basic Auth** (painel: "Habilitar autenticação" → Usuário + Senha),
      não por HMAC/X-Hub-Signature. Enquanto o código validava HMAC, NENHUM valor
      de secret poderia funcionar. Corrigido em `webhookAuth.ts`.
- [x] **Máximo de tentativas era 1** → agora 3. Com uma só, qualquer instabilidade
      perdia a confirmação do pagamento em definitivo.
- [x] Credenciais no cluster: `PAGARME_WEBHOOK_USER` + `PAGARME_WEBHOOK_SECRET`
      (a senha do painel).

Verificado em produção: sem credencial → **401**, credencial errada → **401**,
credencial correta → **200**. O ciclo do cartão fecha: paciente paga → `order.paid`
autenticado → sessão vira `confirmada` → SSE + WhatsApp + email.

> ⚠️ Ao criar o webhook do ambiente **live** no go-live, repetir os três pontos:
> URL correta, autenticação habilitada (Basic) e tentativas > 1.

- [ ] **`PAGARME_RECIPIENT_PLATAFORMA`** — recipient da conta da Audere (sandbox),
      destino da comissão de 2,5% no split. Bloqueado: a conta ainda não tem
      recebedores liberados (ver §4). Script pronto:
      `npm run pagarme:recipient-plataforma`.

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
- [ ] Recriar no ambiente live: webhook (URL + Basic Auth) e recipient da plataforma.
- [ ] ⚠️ **Modelo de negócio do PIX**: em Configurações → Meios de pagamento, o
      sandbox usa **Simulator** e o live precisa de **PSP** (com credenciamento
      feito). Foi o "Simulator vs PSP" que manteve o PIX quebrado no teste.
- [ ] ⚠️ **Recipients são por ambiente**: os psicólogos que fizerem o onboarding
      de recebimento em sandbox terão de refazê-lo (ou ser migrados) no live.
      Pesar isso antes de abrir o beta para muita gente com KYC completo.
- [ ] No código: trocar `BETA_LIBERADO` para `false` em `src/server/lib/planos.ts`
      + redeploy.

## 🔒 5. Segurança / hardening
- [ ] Confirmar que `ENCRYPTION_KEY` e `NEXTAUTH_SECRET` são valores **reais e
      definitivos** (trocar `ENCRYPTION_KEY` depois torna dados clínicos ilegíveis).
- [x] `EVOLUTION_WEBHOOK_TOKEN` definido → validação do webhook da Evolution
      **ativa** (verificado no secret, ago/2026).
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
