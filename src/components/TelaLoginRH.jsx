import { useState } from 'react'
import logo from '../../logo.png'

export default function TelaLoginRH({ onLogin }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarAjuda, setMostrarAjuda] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const ok = await onLogin(senha)
    if (!ok) setErro('Senha incorreta.')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logo} alt="Smash do Cabo" style={{ width: 150, height: 'auto', marginBottom: 12 }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Smash do Cabo</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>Painel de RH - Gerencia</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={lbl}>Senha de acesso</label>
          <input style={inp} type="password" placeholder="��������" value={senha} onChange={e => setSenha(e.target.value)} autoFocus />
          {erro && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{erro}</div>}
          <button disabled={loading} style={{ width: '100%', padding: 13, background: loading ? '#ccc' : '#e63946', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <button type="button" onClick={() => setMostrarAjuda(v => !v)} style={{ width: '100%', marginTop: 12, padding: 8, background: 'transparent', color: '#666', border: 'none', fontSize: 13, cursor: 'pointer' }}>
            Esqueci a senha
          </button>
        </form>

        {mostrarAjuda && (
          <div style={{ marginTop: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, fontSize: 13, color: '#444', lineHeight: 1.45 }}>
            Altere a senha no Supabase, tabela <strong>rh_configuracoes</strong>, chave <strong>admin_senha</strong>.
            <div style={{ marginTop: 8, color: '#777' }}>
              Edite o campo <strong>valor</strong> e recarregue esta tela.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }
const inp = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 16, marginBottom: 16, boxSizing: 'border-box', outline: 'none' }
