# INFRA.md — Pendências de infraestrutura · Audere

> App: monolito Next.js, **1 pod** `aurencare-web` · namespace `aurencare` · secret
> `aurencare-secrets`. **Deploy automático no push para `main`** (GitHub Actions:
> build → migrate → rollout). As migrations rodam sozinhas na esteira.
>
> Marque `[x]` conforme concluir.

---

## 🔴 1. Agora — ligar a transcrição (AssemblyAI)
Sem isso, áudio do paciente e o fallback de fala do psicólogo no tablet não funcionam.

- [ ] Definir a key no secret e reiniciar:
  ```bash
  kubectl patch secret aurencare-secrets -n aurencare --type merge \
    -p '{"stringData":{"ASSEMBLYAI_API_KEY":"<KEY>"}}'
  kubectl rollout restart deploy/aurencare-web -n aurencare
  kubectl rollout status  deploy/aurencare-web -n aurencare
  ```
- [ ] Conferir: `kubectl get secret aurencare-secrets -n aurencare -o jsonpath='{.data.ASSEMBLYAI_API_KEY}' | base64 -d; echo`
- [ ] **Rotacionar** a key na AssemblyAI (foi compartilhada em texto) após validar.

Destrava: transcrição do paciente, fallback do tablet, multilíngue (PT/EN) e
qualidade do PT (antes ia no modelo inglês default).

## 🟠 2. Confiabilidade do vídeo — servidor TURN (#11)
Chamadas caem atrás de NAT/4G porque hoje só há **STUN** (sem TURN).

- [x] **Código pronto** — app já lê TURN do cluster: `src/server/lib/turn.ts`
      (credenciais **efêmeras** HMAC, modo coturn `use-auth-secret`), rota
      `/api/ice`, `useWebRTC` busca os ICE servers de lá (fallback STUN-only).
- [ ] Subir o **coturn**: `kubectl apply -f k8s/coturn.yaml` (manifesto pronto).
- [ ] Liberar no firewall: `3478/udp,tcp`, `5349/tcp`, relay `49160-49200/udp`;
      DNS `turn.audere.ia.br` → IP público do nó.
- [ ] Criar o secret do coturn e setar a mesma chave no app:
  ```bash
  SECRET=$(openssl rand -hex 32)
  kubectl -n aurencare create secret generic coturn-auth \
    --from-literal=static-auth-secret="$SECRET"
  kubectl patch secret aurencare-secrets -n aurencare --type merge \
    -p "{\"stringData\":{\"TURN_STATIC_AUTH_SECRET\":\"$SECRET\",\"TURN_URLS\":\"turn:turn.audere.ia.br:3478?transport=udp,turn:turn.audere.ia.br:3478?transport=tcp,turns:turn.audere.ia.br:5349\"}}"
  kubectl rollout restart deploy/aurencare-web -n aurencare
  ```
  (Alternativa: serviço gerenciado → use `TURN_USERNAME`/`TURN_PASSWORD`.)

## 🟡 3. Cobrança (quando sair do beta — NÃO urgente)
Hoje `BETA_LIBERADO=true` (acesso liberado, sem cobrança). Para ligar:

- [ ] `PAGARME_API_KEY` (sk_live) e `PAGARME_WEBHOOK_SECRET` no secret.
- [ ] `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` (pk_live) — ⚠️ **é build-time**: tem que entrar
      no **build da imagem** (`--build-arg` no `build-push.sh` ou env do job de build),
      **não** só no secret de runtime.
- [ ] Cadastrar o webhook no painel Pagar.me → `https://aurencare.automaxia.com.br/api/webhooks/pagarme`
      (eventos: subscription.charged/canceled, invoice.paid, charge.payment_failed).
- [ ] No código: trocar `BETA_LIBERADO` para `false` em `src/server/lib/planos.ts` + redeploy.

## 🔒 4. Segurança / hardening
- [ ] Confirmar que `ENCRYPTION_KEY` e `NEXTAUTH_SECRET` são valores **reais e
      definitivos** (trocar `ENCRYPTION_KEY` depois torna dados clínicos ilegíveis).
- [ ] `EVOLUTION_WEBHOOK_TOKEN` e `PAGARME_WEBHOOK_SECRET` definidos → ativam a
      validação de assinatura dos webhooks (hoje degradam sem validar).
- [ ] Rotacionar credenciais já expostas no histórico: AssemblyAI (agora), Resend,
      e decidir sobre a Evolution API key.

## ⚙️ 5. Operação
- [ ] Migrar o cron in-process (node-cron) para **CronJob do k8s** + definir
      `CRON_SECRET` (evita lembrete duplicado se subir mais de 1 pod).

---

## 🐞 Diagnóstico (não é config — precisa reproduzir)
- [ ] **#8 confirmação do paciente falhando:** reproduzir e enviar o log
  ```bash
  kubectl logs deploy/aurencare-web -n aurencare --tail=200 | grep confirmacao.action
  ```

---

*Atualizado: jun/2026. Itens de código associados ficam com o time de dev.*
