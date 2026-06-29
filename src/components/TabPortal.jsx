import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function TabPortal() {
  const [usuarios, setUsuarios] = useState([])
  const [funcionarios, setFuncionarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nome: '', cpf: '', senha: '', ativo: true })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busca, setBusca] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: u }, { data: f }] = await Promise.all([
      supabase.from('portal_usuarios').select('*').order('nome'),
      supabase.from('rh_funcionarios').select('id,nome,cpf').eq('status', 'ativo').order('nome')
    ])
    if (u) setUsuarios(u)
    if (f) setFuncionarios(f)
    setLoading(false)
  }

  function formatCPF(v) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  function preencherDeFuncionario(f) {
    setForm({ nome: f.nome, cpf: f.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'), senha: '', ativo: true })
  }

  async function salvar() {
    if (!form.nome || !form.cpf || !form.senha) { setMsg({ tipo: 'erro', texto: 'Nome, CPF e senha são obrigatórios.' }); return }
    setSalvando(true)
    const payload = { nome: form.nome.toUpperCase(), cpf: form.cpf.replace(/\D/g, ''), senha: form.senha, ativo: form.ativo }
    let error
    if (editando === 'novo') {
      const res = await supabase.from('portal_usuarios').insert(payload)
      error = res.error
    } else {
      const res = await supabase.from('portal_usuarios').update(payload).eq('id', editando)
      error = res.error
    }
    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Salvo!' })
      carregar()
      setTimeout(() => { setEditando(null); setMsg(null) }, 1500)
    }
    setSalvando(false)
  }

  async function toggleAtivo(u) {
    await supabase.from('portal_usuarios').update({ ativo: !u.ativo }).eq('id', u.id)
    carregar()
  }

  const filtrados = usuarios.filter(u =>
    u.nome.toLowerCase().includes(busca.toLowerCase()) ||
    u.cpf.includes(busca.replace(/\D/g, ''))
  )

  // Funcionários sem acesso ao portal
  const semAcesso = funcionarios.filter(f => !usuarios.find(u => u.cpf === f.cpf))

  return (
    <div>
      <h2 style={h2}>Portal do Funcionário</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
        Gerencie o acesso dos funcionários ao <strong>consulta.smashdocabo.com</strong>
      </p>

      {/* Alerta sem acesso */}
      {semAcesso.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 8, fontSize: 13 }}>
            {semAcesso.length} funcionário(s) sem acesso ao portal:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {semAcesso.map(f => (
              <button key={f.id} onClick={() => { setEditando('novo'); preencherDeFuncionario(f); setMsg(null) }}
                style={{ background: '#e63946', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                + {f.nome.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form edição */}
      {editando && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
            {editando === 'novo' ? 'Novo acesso' : 'Editar acesso'}
          </div>
          <label style={lbl}>Nome</label>
          <input style={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="NOME COMPLETO" />
          <label style={lbl}>CPF</label>
          <input style={inp} value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))} placeholder="000.000.000-00" />
          <label style={lbl}>Senha de acesso</label>
          <input style={inp} value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Senha gerada por você" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />
            <label htmlFor="ativo" style={{ fontSize: 14 }}>Acesso ativo</label>
          </div>
          {msg && (
            <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
              {msg.texto}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: 11, background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setEditando(null)} style={{ padding: '11px 16px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Busca + botão */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input style={{ ...inp, flex: 1, marginBottom: 0 }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
        <button onClick={() => { setEditando('novo'); setForm({ nome: '', cpf: '', senha: '', ativo: true }); setMsg(null) }}
          style={{ background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Novo
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>
      ) : filtrados.map(u => (
        <div key={u.id} style={{ ...card, marginBottom: 8, opacity: u.ativo ? 1 : 0.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nome}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                {u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                {' - Senha: '}
                <span style={{ fontFamily: 'monospace', color: '#333' }}>{u.senha}</span>
              </div>
              {!u.ativo && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Acesso bloqueado</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setEditando(u.id); setForm({ nome: u.nome, cpf: u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'), senha: u.senha, ativo: u.ativo }); setMsg(null) }}
                style={btnAcao}>Editar</button>
              <button onClick={() => toggleAtivo(u)} style={{ ...btnAcao, color: u.ativo ? '#dc2626' : '#16a34a' }}>
                {u.ativo ? 'Bloquear' : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const h2 = { margin: '0 0 8px', fontSize: 18, fontWeight: 700 }
const card = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }
const btnAcao = { background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }



