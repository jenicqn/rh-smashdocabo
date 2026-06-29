import { useState } from 'react'
import logo from '../../logo.png'
import { supabase } from '../supabase'

export default function TelaLoginFuncionario({ onLogin }) {
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  function formatCPF(v) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const cpfLimpo = cpf.replace(/\D/g, '')
    const { data, error } = await supabase
      .from('portal_usuarios')
      .select('*')
      .eq('cpf', cpfLimpo)
      .eq('ativo', true)
      .single()

    if (error || !data) {
      setErro('CPF não encontrado ou acesso inativo.')
      setLoading(false)
      return
    }
    if (data.senha !== senha) {
      setErro('Senha incorreta.')
      setLoading(false)
      return
    }
    onLogin(data)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logo} alt="Smash do Cabo" style={{ width: 150, height: 'auto', marginBottom: 12 }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Smash do Cabo</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>Portal do Funcionário</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={lbl}>CPF</label>
          <input style={inp} type="text" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} autoFocus />
          <label style={lbl}>Senha</label>
          <input style={inp} type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} />
          {erro && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{erro}</div>}
          <button style={{ width: '100%', padding: 13, background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 16, marginBottom: 16, boxSizing: 'border-box', outline: 'none' }


