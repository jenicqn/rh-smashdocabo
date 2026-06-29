CREATE TABLE IF NOT EXISTS public.rh_documentos_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text DEFAULT 'Outro',
  descricao text,
  url text NOT NULL,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.rh_documentos_empresa
ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;

WITH ordenados AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS nova_ordem
  FROM public.rh_documentos_empresa
)
UPDATE public.rh_documentos_empresa d
SET ordem = ordenados.nova_ordem
FROM ordenados
WHERE d.id = ordenados.id
  AND COALESCE(d.ordem, 0) = 0;

ALTER TABLE public.rh_documentos_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_rh_docs" ON public.rh_documentos_empresa;
CREATE POLICY "allow_all_rh_docs"
ON public.rh_documentos_empresa
FOR ALL
USING (true)
WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-empresa', 'documentos-empresa', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "allow_all_documentos_empresa" ON storage.objects;
CREATE POLICY "allow_all_documentos_empresa"
ON storage.objects
FOR ALL
USING (bucket_id = 'documentos-empresa')
WITH CHECK (bucket_id = 'documentos-empresa');
