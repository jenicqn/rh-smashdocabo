ALTER TABLE public.portal_usuarios
ADD COLUMN IF NOT EXISTS ultimo_acesso timestamp with time zone;

ALTER TABLE public.rh_funcionarios
ADD COLUMN IF NOT EXISTS ultimo_acesso_portal timestamp with time zone;
