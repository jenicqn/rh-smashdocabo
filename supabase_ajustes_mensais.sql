-- Ajustes mensais manuais por funcionário
-- Use para lançar comissão fechada e banco de horas fechado de meses sem arquivo.

CREATE TABLE IF NOT EXISTS public.rh_ajustes_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id),
  mes TEXT NOT NULL,
  comissao NUMERIC(10,2) DEFAULT 0,
  banco_horas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(funcionario_id, mes)
);

ALTER TABLE public.rh_ajustes_mensais ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rh_ajustes_mensais
ALTER COLUMN banco_horas DROP DEFAULT;

DROP POLICY IF EXISTS "allow_all_rh_ajustes" ON public.rh_ajustes_mensais;

CREATE POLICY "allow_all_rh_ajustes"
ON public.rh_ajustes_mensais
FOR ALL
USING (true);
