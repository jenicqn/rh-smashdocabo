CREATE TABLE IF NOT EXISTS public.rh_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  descricao text DEFAULT 'Feriado',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.rh_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_rh_feriados" ON public.rh_feriados;
CREATE POLICY "allow_all_rh_feriados"
ON public.rh_feriados
FOR ALL
USING (true)
WITH CHECK (true);
