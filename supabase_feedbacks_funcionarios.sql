CREATE TABLE IF NOT EXISTS public.rh_feedbacks_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid,
  funcionario_nome text,
  cpf text,
  tipo text NOT NULL DEFAULT 'Sugestão',
  mensagem text NOT NULL,
  identificado boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'novo',
  resposta text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS funcionario_id uuid;

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS funcionario_nome text;

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS cpf text;

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'Sugestão';

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS mensagem text NOT NULL DEFAULT '';

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS identificado boolean NOT NULL DEFAULT true;

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'novo';

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS resposta text;

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

ALTER TABLE public.rh_feedbacks_funcionarios
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

ALTER TABLE public.rh_feedbacks_funcionarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_rh_feedbacks" ON public.rh_feedbacks_funcionarios;
CREATE POLICY "allow_all_rh_feedbacks"
ON public.rh_feedbacks_funcionarios
FOR ALL
USING (true)
WITH CHECK (true);
