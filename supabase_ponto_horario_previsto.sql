-- Necessário para salvar o horário de entrada editado por dia no ponto.
-- Execute no SQL Editor do Supabase.

ALTER TABLE registros_ponto
ADD COLUMN IF NOT EXISTS horario_previsto TEXT;
