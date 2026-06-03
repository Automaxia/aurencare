#!/usr/bin/env bash
# Build da imagem do Auren Care (Next.js standalone — uma imagem só)
# e push pro Docker Hub com dois nomes: aurencare-web e aurencare-api,
# ambos apontando pra mesma SHA. Isso garante paridade entre os pods.
#
# Uso:
#   ./scripts/build-push.sh                  # builda e dá push :latest + :<sha>
#   ./scripts/build-push.sh --no-push        # só builda, não publica
#   ./scripts/build-push.sh --platform=amd64 # força plataforma do cluster
#
# Pré-requisitos:
#   - docker login (usuário com acesso a wesleyromualdo/*)
#   - rodar do root do repo

set -euo pipefail

REGISTRY="wesleyromualdo"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH=true

for arg in "$@"; do
  case "$arg" in
    --no-push)         PUSH=false ;;
    --platform=*)      PLATFORM="${arg#*=}" ;;
    *) echo "arg desconhecido: $arg" >&2; exit 2 ;;
  esac
done

# SHA curta do commit atual — usada como tag imutável
if ! SHA=$(git rev-parse --short HEAD 2>/dev/null); then
  echo "✗ não é um repo git ou sem commits"
  exit 1
fi

# Avisa se o working tree estiver sujo (build não reflete o que tá no git)
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  working tree sujo — a imagem vai conter mudanças não commitadas"
  SHA="${SHA}-dirty"
fi

echo "── Build Auren Care ──"
echo "  SHA:      $SHA"
echo "  Platform: $PLATFORM"
echo "  Registry: $REGISTRY"
echo ""

# Tags geradas: web e api recebem :latest e :<sha>, todas apontam pra mesma layer
TAGS=(
  "$REGISTRY/aurencare-web:latest"
  "$REGISTRY/aurencare-web:$SHA"
  "$REGISTRY/aurencare-api:latest"
  "$REGISTRY/aurencare-api:$SHA"
)

TAG_ARGS=()
for t in "${TAGS[@]}"; do TAG_ARGS+=("-t" "$t"); done

# NEXT_PUBLIC_* precisa existir no BUILD (é inlinado no client). Exporte a
# public key da Pagar.me no ambiente antes de rodar; vazio = checkout em demo.
BUILD_ARGS=(--build-arg "NEXT_PUBLIC_PAGARME_PUBLIC_KEY=${NEXT_PUBLIC_PAGARME_PUBLIC_KEY:-}")
if [ -n "${NEXT_PUBLIC_PAGARME_PUBLIC_KEY:-}" ]; then
  echo "  Pagar.me pk: ${NEXT_PUBLIC_PAGARME_PUBLIC_KEY:0:8}… (checkout real)"
else
  echo "  Pagar.me pk: (ausente — checkout em modo demonstração)"
fi
echo ""

if $PUSH; then
  # buildx multi-arch + push direto (não fica imagem local)
  docker buildx build \
    --platform "$PLATFORM" \
    --push \
    "${BUILD_ARGS[@]}" \
    "${TAG_ARGS[@]}" \
    .
  echo ""
  echo "✓ publicado:"
  for t in "${TAGS[@]}"; do echo "    $t"; done
else
  docker buildx build \
    --platform "$PLATFORM" \
    --load \
    "${BUILD_ARGS[@]}" \
    "${TAG_ARGS[@]}" \
    .
  echo ""
  echo "✓ build local pronto (sem push):"
  for t in "${TAGS[@]}"; do echo "    $t"; done
fi
