import { useState, useEffect } from 'react'
import TelaLoginRH from './components/TelaLoginRH'
import Dashboard from './components/Dashboard'
import TelaLoginFuncionario from './components/TelaLoginFuncionario'
import TelaFuncionario from './components/TelaFuncionario'
import { supabase } from './supabase'

const SESSAO_MS = 5 * 60 * 1000
const STORAGE_RH = 'rh_smash_sessao'
const STORAGE_PORTAL = 'rh_smash_portal_sessao'

// Detecta se é o portal do funcionário pelo domínio/hostname
function isPortalFuncionario() {
  const host = window.location.hostname
  return host.includes('consulta') || window.location.port === '5174'
}

async function autenticarAdmin(senha) {
  const { data, error } = await supabase.rpc('autenticar_admin', {
    senha_digitada: senha,
  })

  if (error) {
    console.error('Erro ao autenticar administrador:', error)
    return false
  }

  return data === true
}

function lerSessao(chave) {
  try {
    const sessao = JSON.parse(localStorage.getItem(chave) || 'null')
    if (!sessao?.lastActivity || Date.now() - sessao.lastActivity > SESSAO_MS) {
      localStorage.removeItem(chave)
      return null
    }
    return sessao
  } catch {
    localStorage.removeItem(chave)
    return null
  }
}

function salvarSessao(chave, dados = {}) {
  localStorage.setItem(chave, JSON.stringify({ ...dados, lastActivity: Date.now() }))
}

export default function App() {
  const [modo] = useState(isPortalFuncionario() ? 'consulta' : 'rh')
  const [logado, setLogado] = useState(false)
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    const sessao = lerSessao(modo === 'rh' ? STORAGE_RH : STORAGE_PORTAL)
    if (modo === 'rh' && sessao) setLogado(true)
    if (modo === 'consulta' && sessao?.usuario) setUsuario(sessao.usuario)
  }, [modo])

  useEffect(() => {
    function renovarSessao() {
      if (modo === 'rh' && logado) salvarSessao(STORAGE_RH)
      if (modo === 'consulta' && usuario) salvarSessao(STORAGE_PORTAL, { usuario })
    }

    window.addEventListener('click', renovarSessao)
    window.addEventListener('keydown', renovarSessao)
    window.addEventListener('touchstart', renovarSessao)
    window.addEventListener('scroll', renovarSessao)
    const timer = setInterval(() => {
      const sessao = lerSessao(modo === 'rh' ? STORAGE_RH : STORAGE_PORTAL)
      if (!sessao) {
        setLogado(false)
        setUsuario(null)
      }
    }, 30000)

    return () => {
      window.removeEventListener('click', renovarSessao)
      window.removeEventListener('keydown', renovarSessao)
      window.removeEventListener('touchstart', renovarSessao)
      window.removeEventListener('scroll', renovarSessao)
      clearInterval(timer)
    }
  }, [modo, logado, usuario])

  // --- MODO RH ---
  if (modo === 'rh') {
    if (!logado) return (
      <TelaLoginRH onLogin={async (senha) => {
        const autenticado = await autenticarAdmin(senha)
        if (autenticado) {
          salvarSessao(STORAGE_RH)
          setLogado(true)
          return true
        }
        return false
      }} />
    )
    return <Dashboard onLogout={() => { localStorage.removeItem(STORAGE_RH); setLogado(false) }} />
  }

  // --- MODO CONSULTA ---
  if (!usuario) return (
    <TelaLoginFuncionario onLogin={(u) => { salvarSessao(STORAGE_PORTAL, { usuario: u }); setUsuario(u) }} />
  )
  return <TelaFuncionario usuario={usuario} onLogout={() => { localStorage.removeItem(STORAGE_PORTAL); setUsuario(null) }} />
}


