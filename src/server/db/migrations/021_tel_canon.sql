-- Chave canônica de telefone, robusta ao "nono dígito" e ao prefixo país 55.
-- Retorna DDD(2) + os 8 últimos dígitos (o subscriber), ignorando o 9 extra.
--   5561999423445 (país+DDD+9+8) → 6199423445
--   61999423445   (DDD+9+8)      → 6199423445
--   6199423445    (DDD+8)        → 6199423445
-- O país 55 só é removido quando sobra >=12 dígitos, pra não comer a DDD 55
-- (Santa Maria/RS) de um número nacional. NULL se <10 dígitos (não casa).
CREATE OR REPLACE FUNCTION tel_canon(t text) RETURNS text AS $$
  SELECT CASE WHEN length(n2) >= 10
              THEN substr(n2, 1, 2) || right(n2, 8)
              ELSE NULL END
  FROM (
    SELECT CASE WHEN d LIKE '55%' AND length(d) >= 12 THEN substr(d, 3) ELSE d END AS n2
    FROM (SELECT regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g') AS d) a
  ) b
$$ LANGUAGE sql IMMUTABLE;
