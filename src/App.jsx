import { useState, useEffect } from 'react'
import TelaLoginRH from './components/TelaLoginRH'
import Dashboard from './components/Dashboard'
import TelaLoginFuncionario from './components/TelaLoginFuncionario'
import TelaFuncionario from './components/TelaFuncionario'
import { supabase } from './supabase'

const ADMIN_SENHA = import.meta.env.VITE_ADMIN_SENHA || 'smash@rh2026'

// Detecta se e o portal do funcionario pelo dominio/hostname
function isPortalFuncionario() {
  const host = window.location.hostname
  return host.includes('consulta') || window.location.port === '5174'
}

async function buscarSenhaAdmin() {
  const { data, error } = await supabase
    .from('rh_configuracoes')
    .select('valor')
    .eq('chave', 'admin_senha')
    .maybeSingle()

  if (error || !data?.valor) return ADMIN_SENHA
  return data.valor
}

export default function App() {
  const [modo] = useState(isPortalFuncionario() ? 'consulta' : 'rh')
  const [logado, setLogado] = useState(false)
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    if (modo === 'rh') {
      const s = sessionStorage.getItem('rh_smash_logado')
      if (s === 'true') setLogado(true)
    }
  }, [])

  // --- MODO RH ---
  if (modo === 'rh') {
    if (!logado) return (
      <TelaLoginRH onLogin={async (senha) => {
        const senhaAdmin = await buscarSenhaAdmin()
        if (senha === senhaAdmin) {
          sessionStorage.setItem('rh_smash_logado', 'true')
          setLogado(true)
          return true
        }
        return false
      }} />
    )
    return <Dashboard onLogout={() => { sessionStorage.removeItem('rh_smash_logado'); setLogado(false) }} />
  }

  // --- MODO CONSULTA ---
  if (!usuario) return (
    <TelaLoginFuncionario onLogin={(u) => setUsuario(u)} />
  )
  return <TelaFuncionario usuario={usuario} onLogout={() => setUsuario(null)} />
}
