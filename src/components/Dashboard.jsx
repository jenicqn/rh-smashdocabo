import { useState } from 'react'
import logo from '../../logo.png'
import TabPonto from './TabPonto'
import TabComissoes from './TabComissoes'
import TabZonas from './TabZonas'
import TabFaltas from './TabFaltas'
import TabAdvertencias from './TabAdvertencias'
import TabFuncionarios from './TabFuncionarios'
import TabPortal from './TabPortal'
import TabAjustesMensais from './TabAjustesMensais'

const ABAS = [
  { id: 'ponto', label: 'Ponto' },
  { id: 'comissões', label: 'Comissões' },
  { id: 'zonas', label: 'Zonas' },
  { id: 'faltas', label: 'Faltas' },
  { id: 'advertencias', label: 'Advertências' },
  { id: 'funcionários', label: 'Funcionários' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'portal', label: 'Portal' },
]

export default function Dashboard({ onLogout }) {
  const [aba, setAba] = useState('ponto')
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ background: '#1a1a1a', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="Smash do Cabo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>Smash do Cabo</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Painel de RH</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Sair</button>
      </div>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', overflowX: 'auto' }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '13px 16px', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: aba === a.id ? 700 : 400,
            color: aba === a.id ? '#e63946' : '#666',
            borderBottom: aba === a.id ? '2px solid #e63946' : '2px solid transparent',
            background: 'none', whiteSpace: 'nowrap'
          }}>{a.label}</button>
        ))}
      </div>
      <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto' }}>
        {aba === 'ponto' && <TabPonto />}
        {aba === 'comissões' && <TabComissoes />}
        {aba === 'zonas' && <TabZonas />}
        {aba === 'faltas' && <TabFaltas />}
        {aba === 'advertencias' && <TabAdvertencias />}
        {aba === 'funcionários' && <TabFuncionarios />}
        {aba === 'ajustes' && <TabAjustesMensais />}
        {aba === 'portal' && <TabPortal />}
      </div>
    </div>
  )
}


