-- Métricas de silêncio por sessão (Tarefa 2a): duração real transmitida vs fala
-- do paciente, capturadas no cliente a partir dos timestamps da AssemblyAI.
-- Shape: { audioMs, speechMs, turnos, primeiroMs, ultimoMs }. Aditiva, nullable.
ALTER TABLE sessoes
  ADD COLUMN IF NOT EXISTS transcricao_stats JSONB;
