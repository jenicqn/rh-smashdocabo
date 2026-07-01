ALTER TABLE public.rh_faltas
ADD COLUMN IF NOT EXISTS documento_path text,
ADD COLUMN IF NOT EXISTS documento_nome text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-faltas', 'documentos-faltas', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "allow_all_documentos_faltas" ON storage.objects;
CREATE POLICY "allow_all_documentos_faltas"
ON storage.objects
FOR ALL
USING (bucket_id = 'documentos-faltas')
WITH CHECK (bucket_id = 'documentos-faltas');
