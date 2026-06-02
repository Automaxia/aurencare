import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Endpoint público de healthcheck — alimenta readiness/liveness probes
 * do Kubernetes (k8s/aurencare-api.yaml) e similares.
 *
 * Resposta intencionalmente simples: 200 com timestamp. Não consulta DB
 * nem dependências externas (uma liveness não deve falhar por causa do
 * Postgres oscilar — o orquestrador não deve restartar o pod nesse caso).
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'auren-care',
    timestamp: new Date().toISOString(),
  })
}
