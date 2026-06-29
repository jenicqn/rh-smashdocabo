-- Autenticação segura do painel RH pelo Supabase
-- Execute este arquivo no SQL Editor do Supabase.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS rh_configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rh_configuracoes (chave, valor)
VALUES ('admin_senha', extensions.crypt('smash@rh2026', extensions.gen_salt('bf')))
ON CONFLICT (chave) DO NOTHING;

UPDATE rh_configuracoes
SET valor = extensions.crypt(valor, extensions.gen_salt('bf')),
    updated_at = NOW()
WHERE chave = 'admin_senha'
  AND valor NOT LIKE '$2%';

CREATE OR REPLACE FUNCTION autenticar_admin(senha_digitada TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM rh_configuracoes
    WHERE chave = 'admin_senha'
      AND valor = extensions.crypt(senha_digitada, valor)
  );
END;
$$;

CREATE OR REPLACE FUNCTION alterar_senha_admin(nova_senha TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE rh_configuracoes
  SET valor = extensions.crypt(nova_senha, extensions.gen_salt('bf')),
      updated_at = NOW()
  WHERE chave = 'admin_senha';
END;
$$;

REVOKE ALL ON FUNCTION autenticar_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION alterar_senha_admin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION autenticar_admin(TEXT) TO anon, authenticated;

ALTER TABLE rh_configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_config" ON rh_configuracoes;

-- Para alterar a senha depois, rode no SQL Editor:
-- SELECT alterar_senha_admin('nova_senha_aqui');
