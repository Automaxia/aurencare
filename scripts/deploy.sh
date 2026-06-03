#!/usr/bin/env bash
# Auren Care · deploy no Kubernetes
#
# Aplica namespace, secret de runtime (a partir de .env.production) e
# os manifests de web + api. Idempotente — pode rodar quantas vezes quiser.
#
# Pré-requisitos:
#   - kubectl configurado pro cluster certo (kubectl config current-context)
#   - .env.production no root do repo (gitignored), com as chaves de produção
#   - imagens wesleyromualdo/aurencare-web|api:latest já publicadas (ver build-push.sh)
#   - cert-manager + ingress-nginx + cluster-issuer "letsencrypt-prod-cluster" no cluster
#
# Uso:
#   ./scripts/deploy.sh                 # aplica tudo + espera rollout
#   ./scripts/deploy.sh --skip-secret   # não recria secret (usa o que já tá no cluster)
#   ./scripts/deploy.sh --diff          # mostra diff antes (kubectl diff), não aplica

set -euo pipefail

NAMESPACE="aurencare"
SECRET_NAME="aurencare-secrets"
ENV_FILE=".env.production"
SKIP_SECRET=false
DIFF_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-secret)  SKIP_SECRET=true ;;
    --diff)         DIFF_ONLY=true ;;
    *) echo "arg desconhecido: $arg" >&2; exit 2 ;;
  esac
done

ctx=$(kubectl config current-context)
echo "── Deploy Auren Care ──"
echo "  Contexto: $ctx"
echo "  Namespace: $NAMESPACE"
echo ""
read -r -p "Confirma deploy nesse contexto? (s/N) " ans
[[ "$ans" =~ ^[Ss]$ ]] || { echo "abortado"; exit 1; }

# ── 1. Namespace ──────────────────────────────────────────────────────────
kubectl get ns "$NAMESPACE" >/dev/null 2>&1 \
  || kubectl create namespace "$NAMESPACE"

# ── 2. Secret de runtime ──────────────────────────────────────────────────
# Gerado a partir do .env.production. O arquivo nunca vai pro repo
# (gitignored). O secret é recriado com `apply` pra refletir mudanças no .env.
if ! $SKIP_SECRET; then
  if [ ! -f "$ENV_FILE" ]; then
    echo "✗ $ENV_FILE não existe."
    echo "  Crie a partir do .env.example e preencha com chaves de produção."
    exit 1
  fi
  echo "→ Aplicando secret/$SECRET_NAME a partir de $ENV_FILE"
  # `create --dry-run -o yaml | apply` é o padrão pra upsert de secret
  kubectl create secret generic "$SECRET_NAME" \
    --namespace "$NAMESPACE" \
    --from-env-file "$ENV_FILE" \
    --dry-run=client -o yaml \
    | kubectl apply -f -
fi

# ── 3. Manifests web + api ────────────────────────────────────────────────
if $DIFF_ONLY; then
  echo "→ Diff (não aplica):"
  kubectl diff -f k8s/ || true
  exit 0
fi

echo "→ Aplicando k8s/*.yaml"
kubectl apply -f k8s/

# ── 4. Rollout ────────────────────────────────────────────────────────────
echo "→ Esperando rollout (timeout 5min cada)…"
kubectl rollout status -n "$NAMESPACE" deployment/aurencare-web --timeout=5m
kubectl rollout status -n "$NAMESPACE" deployment/aurencare-api --timeout=5m

echo ""
echo "✓ Deploy ok. Status:"
kubectl get pods,svc,ingress -n "$NAMESPACE"
