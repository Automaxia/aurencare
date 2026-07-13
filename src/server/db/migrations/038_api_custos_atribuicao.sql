-- Instrumentação de custo: atribuição por psicólogo/paciente + natureza do gasto.
-- Migração aditiva (colunas nullable) para não quebrar o histórico já gravado.
-- Contexto: 78% do custo real estava "solto" (LLM sem psicologo_id/sessao_id).

ALTER TABLE api_custos
  ADD COLUMN IF NOT EXISTS paciente_id       UUID,
  -- natureza: 'sessao' (marginal por atendimento) | 'ao_vivo' (durante a sessão)
  --         | 'fundo' (batch/manutenção, não escala com sessão) | 'outros'
  ADD COLUMN IF NOT EXISTS natureza          VARCHAR(20),
  -- só para jobs de fundo/recálculo: quantas sessões/eventos aquela execução processou.
  -- É o campo que revela a curva de custo do grafo de temas.
  ADD COLUMN IF NOT EXISTS escopo_recalculo  INTEGER,
  -- custo em BRL gravado no momento da chamada (snapshot do câmbio corrente),
  -- para não depender de reconversão retroativa. Fonte única do câmbio: precos.ts.
  ADD COLUMN IF NOT EXISTS custo_brl         NUMERIC(12,6) NOT NULL DEFAULT 0;

-- Índices para fatiar custo por psicólogo/paciente/natureza no painel.
CREATE INDEX IF NOT EXISTS idx_api_custos_psicologo ON api_custos (psicologo_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_custos_paciente  ON api_custos (paciente_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_custos_natureza  ON api_custos (natureza, created_at);
