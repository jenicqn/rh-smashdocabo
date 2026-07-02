import { useEffect, useState } from 'react'
import logo from '../../logo.png'
import { supabase } from '../supabase'
import TabPonto from './TabPonto'
import TabComissoes from './TabComissoes'
import TabZonas from './TabZonas'
import TabFaltas from './TabFaltas'
import TabAdvertencias from './TabAdvertencias'
import TabFuncionarios from './TabFuncionarios'
import TabPortal from './TabPortal'
import TabAjustesMensais from './TabAjustesMensais'
import TabDocumentos from './TabDocumentos'
import TabFechamentoFolha from './TabFechamentoFolha'
import TabFeedbacks from './TabFeedbacks'

const ABAS = [
  { id: 'ponto', label: 'Ponto' },
  { id: 'comissões', label: 'Comissões' },
  { id: 'zonas', label: 'Zonas' },
  { id: 'faltas', label: 'Faltas' },
  { id: 'advertencias', label: 'Advertências' },
  { id: 'funcionários', label: 'Funcionários' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'fechamento', label: 'Fechamento de folha' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'feedbacks', label: 'Sugestões' },
  { id: 'portal', label: 'Portal' },
]

export default function Dashboard({ onLogout }) {
  const [aba, setAba] = useState('ponto')
  const [notificacoesAberto, setNotificacoesAberto] = useState(false)
  const [novasSugestoes, setNovasSugestoes] = useState(0)

  useEffect(() => { carregarNotificacoes() }, [aba])

  async function carregarNotificacoes() {
    const { count } = await supabase
      .from('rh_feedbacks_funcionarios')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'novo')

    setNovasSugestoes(count || 0)
  }

  function abrirSugestoes() {
    setAba('feedbacks')
    setNotificacoesAberto(false)
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <button onClick={() => setNotificacoesAberto(v => !v)} title="Notificações" style={bellBtn}>
            <span style={{ fontSize: 17 }}>🔔</span>
            {novasSugestoes > 0 && <span style={badge}>{novasSugestoes > 9 ? '9+' : novasSugestoes}</span>}
          </button>
          {notificacoesAberto && (
            <div style={notificacoesBox}>
              <div style={{ fontWeight: 900, color: '#111', marginBottom: 8 }}>Notificações</div>
              {novasSugestoes > 0 ? (
                <button onClick={abrirSugestoes} style={notificacaoItem}>
                  <strong>{novasSugestoes} sugestão(ões) nova(s)</strong>
                  <span>Mensagens enviadas pelos funcionários.</span>
                </button>
              ) : (
                <div style={{ color: '#777', fontSize: 13, padding: 10 }}>Nenhuma atividade nova no momento.</div>
              )}
            </div>
          )}
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>Sair</button>
        </div>
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
      <div style={{ padding: '24px 16px', maxWidth: aba === 'fechamento' ? 1220 : 900, margin: '0 auto' }}>
        {aba === 'ponto' && <TabPonto />}
        {aba === 'comissões' && <TabComissoes />}
        {aba === 'zonas' && <TabZonas />}
        {aba === 'faltas' && <TabFaltas />}
        {aba === 'advertencias' && <TabAdvertencias />}
        {aba === 'funcionários' && <TabFuncionarios />}
        {aba === 'ajustes' && <TabAjustesMensais />}
        {aba === 'fechamento' && <TabFechamentoFolha />}
        {aba === 'documentos' && <TabDocumentos />}
        {aba === 'feedbacks' && <TabFeedbacks />}
        {aba === 'portal' && <TabPortal />}
      </div>
    </div>
  )
}

const bellBtn = { width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', position: 'relative', display: 'grid', placeItems: 'center' }
const badge = { position: 'absolute', top: -5, right: -5, background: '#e63946', color: '#fff', minWidth: 17, height: 17, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, border: '2px solid #1a1a1a' }
const notificacoesBox = { position: 'absolute', top: 44, right: 58, width: 290, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 18px 45px rgba(0,0,0,0.22)', padding: 12, zIndex: 20 }
const notificacaoItem = { width: '100%', border: 'none', background: '#fff1f2', color: '#333', borderRadius: 9, padding: 11, textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 4, fontSize: 13 }


