-- =============================================
-- RH SMASH DO CABO — Schema completo
-- Execute no SQL Editor do Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS rh_funcionarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  cargo TEXT,
  departamento TEXT,
  data_admissao DATE,
  data_saida DATE,
  status TEXT DEFAULT 'ativo',
  pausas JSONB DEFAULT '[]',
  horario_entrada TEXT DEFAULT '16:00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rh_comissoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes TEXT NOT NULL,
  dia INTEGER NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  funcionarios JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rh_faltas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES rh_funcionarios(id),
  data DATE NOT NULL,
  tipo TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rh_advertencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES rh_funcionarios(id),
  data DATE NOT NULL,
  tipo TEXT NOT NULL,
  motivo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rh_zonas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES rh_funcionarios(id),
  mes TEXT NOT NULL,
  zona INTEGER NOT NULL,
  premio NUMERIC(10,2) DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(funcionario_id, mes)
);

CREATE TABLE IF NOT EXISTS registros_ponto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_cpf TEXT NOT NULL,
  periodo TEXT NOT NULL,
  dia DATE NOT NULL,
  dia_semana TEXT,
  entrada1 TEXT,
  saida1 TEXT,
  entrada2 TEXT,
  saida2 TEXT,
  total_trabalhado TEXT,
  total_noturno TEXT,
  horas_previstas TEXT,
  dia_falta TEXT,
  horas_atraso TEXT,
  extra_0 TEXT,
  extra_100 TEXT,
  banco_total TEXT,
  banco_saldo TEXT,
  justificativa TEXT,
  tipo_dia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(funcionario_cpf, dia)
);

CREATE TABLE IF NOT EXISTS uploads_ponto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo TEXT NOT NULL,
  arquivo TEXT NOT NULL,
  funcionario_nome TEXT NOT NULL,
  funcionario_cpf TEXT NOT NULL,
  total_registros INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rh_configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rh_configuracoes (chave, valor)
VALUES ('admin_senha', 'smash@rh2026')
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE rh_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_faltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_advertencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_rh_func" ON rh_funcionarios FOR ALL USING (true);
CREATE POLICY "allow_all_rh_com" ON rh_comissoes FOR ALL USING (true);
CREATE POLICY "allow_all_rh_faltas" ON rh_faltas FOR ALL USING (true);
CREATE POLICY "allow_all_rh_adv" ON rh_advertencias FOR ALL USING (true);
CREATE POLICY "allow_all_rh_zonas" ON rh_zonas FOR ALL USING (true);
CREATE POLICY "allow_all_ponto" ON registros_ponto FOR ALL USING (true);
CREATE POLICY "allow_all_uploads" ON uploads_ponto FOR ALL USING (true);
CREATE POLICY "allow_all_portal" ON portal_usuarios FOR ALL USING (true);
CREATE POLICY "allow_all_config" ON rh_configuracoes FOR ALL USING (true);
