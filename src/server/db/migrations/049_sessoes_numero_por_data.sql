-- ──────────────────────────────────────────────────────────────────────────
-- Número da sessão pela DATA em que acontece, não pela ordem de criação.
--
-- Até aqui `numero` era MAX+1 no momento de criar. Pacote de 4 sessões (#1–#4)
-- + uma extra marcada entre a #2 e a #3 ficava como #5. A partir de agora o
-- app renumera pela data (`renumerarPorData` em services/sessoes.ts); esta
-- migration aplica a MESMA regra ao que já existe:
--
--  · sessão com documento gerado ou assinatura (assinada, resumo_ia,
--    resumo_curto, laudo) NUNCA muda — o número está escrito no texto;
--  · só se renumera o que vem depois (na agenda) da última sessão com
--    documento do paciente, continuando do maior número até ela;
--  · empate de data_hora desempata por created_at e id.
--
-- Idempotente: rodar de novo não muda nada (só atualiza onde o número difere).
-- Sem UNIQUE em (paciente_id, numero), o UPDATE em lote não esbarra em
-- conflito transitório.
-- ──────────────────────────────────────────────────────────────────────────

WITH ord AS (
  SELECT id, paciente_id, numero,
         (COALESCE(assinada, FALSE) OR resumo_ia IS NOT NULL
          OR resumo_curto IS NOT NULL OR laudo IS NOT NULL) AS tem_documento,
         ROW_NUMBER() OVER (PARTITION BY paciente_id ORDER BY data_hora, created_at, id) AS pos
    FROM sessoes
), corte AS (
  SELECT paciente_id, COALESCE(MAX(pos) FILTER (WHERE tem_documento), 0) AS ult_doc
    FROM ord GROUP BY paciente_id
), base AS (
  SELECT c.paciente_id, c.ult_doc,
         COALESCE(MAX(o.numero) FILTER (WHERE o.pos <= c.ult_doc), 0) AS base
    FROM corte c JOIN ord o USING (paciente_id)
   GROUP BY c.paciente_id, c.ult_doc
), novo AS (
  SELECT o.id, b.base + ROW_NUMBER() OVER (PARTITION BY o.paciente_id ORDER BY o.pos) AS n
    FROM ord o JOIN base b USING (paciente_id)
   WHERE o.pos > b.ult_doc
)
UPDATE sessoes s
   SET numero = novo.n
  FROM novo
 WHERE s.id = novo.id AND s.numero <> novo.n;
