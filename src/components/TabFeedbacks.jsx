import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const STATUS = ['todos', 'novo', 'lido', 'resolvido']

function formatarDataHora(valor) {
  if (!valor) return ''
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TabFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => { carregarFeedbacks() }, [])

  async function carregarFeedbacks() {
    setLoading(true)
    setMsg(null)

    const { data, error } = await supabase
      .from('rh_feedbacks_funcionarios')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setFeedbacks([])
      setMsg({ tipo: 'erro', texto: `${error.message}. Rode o SQL supabase_feedbacks_funcionarios.sql no Supabase.` })
    } else {
      setFeedbacks(data || [])
    }

    setLoading(false)
  }

  async function alterarStatus(item, status) {
    const { error } = await supabase
      .from('rh_feedbacks_funcionarios')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', item.id)

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
      return
    }

    setFeedbacks(lista => lista.map(f => f.id === item.id ? { ...f, status } : f))
  }

  async function remover(item) {
    if (!confirm('Remover esta mensagem?')) return
    const { error } = await supabase
      .from('rh_feedbacks_funcionarios')
      .delete()
      .eq('id', item.id)

    if (error) {
      setMsg({ tipo: 'erro', texto: error.message })
      return
    }

    setFeedbacks(lista => lista.filter(f => f.id !== item.id))
  }

  const listaFiltrada = filtro === 'todos'
    ? feedbacks
    : feedbacks.filter(f => (f.status || 'novo') === filtro)

  const novos = feedbacks.filter(f => (f.status || 'novo') === 'novo').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={h2}>Sugestões dos funcionários</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            Mensagens enviadas pelo portal do funcionário.
          </p>
        </div>
        <button onClick={carregarFeedbacks} style={btnGhost}>Atualizar</button>
      </div>

      {msg && (
        <div style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 12, background: msg.tipo === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.tipo === 'ok' ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 700 }}>
          {msg.texto}
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
        <Resumo label="Total recebido" valor={feedbacks.length} />
        <Resumo label="Novas" valor={novos} alerta={novos > 0} />
        <Resumo label="Resolvidas" valor={feedbacks.filter(f => f.status === 'resolvido').length} destaque />
      </section>

      <section style={card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {STATUS.map(status => (
            <button key={status} onClick={() => setFiltro(status)} style={btnFiltro(filtro === status)}>
              {status === 'todos' ? 'Todas' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={empty}>Carregando...</div>
        ) : listaFiltrada.length === 0 ? (
          <div style={empty}>Nenhuma mensagem encontrada.</div>
        ) : listaFiltrada.map(item => (
          <article key={item.id} style={feedbackCard(item.status)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{item.tipo || 'Mensagem'}</div>
                <div style={{ color: '#777', fontSize: 12, marginTop: 3 }}>
                  {item.identificado ? (item.funcionario_nome || 'Funcionário identificado') : 'Mensagem anônima'} · {formatarDataHora(item.created_at)}
                </div>
                {item.identificado && item.cpf && (
                  <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>CPF: {item.cpf}</div>
                )}
              </div>
              <span style={badge(item.status)}>{item.status || 'novo'}</span>
            </div>

            <div style={{ color: '#333', fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap', marginBottom: 12 }}>
              {item.mensagem}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={() => alterarStatus(item, 'lido')} style={btnMini}>Marcar como lida</button>
              <button onClick={() => alterarStatus(item, 'resolvido')} style={btnMiniOk}>Resolver</button>
              <button onClick={() => remover(item)} style={btnMiniDanger}>Remover</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

function Resumo({ label, valor, alerta, destaque }) {
  return (
    <div style={{ background: alerta ? '#fef2f2' : destaque ? '#f0fdf4' : '#fff', border: `1px solid ${alerta ? '#fecaca' : destaque ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#666', fontWeight: 800, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: alerta ? '#dc2626' : destaque ? '#16a34a' : '#111' }}>{valor}</div>
    </div>
  )
}

const h2 = { margin: 0, fontSize: 18, fontWeight: 800 }
const card = { background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }
const empty = { color: '#888', fontSize: 13, textAlign: 'center', padding: 30 }
const btnGhost = { background: '#f3f4f6', color: '#333', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }
const btnFiltro = (active) => ({ background: active ? '#e63946' : '#f3f4f6', color: active ? '#fff' : '#555', border: 'none', borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' })
const feedbackCard = (status) => ({ border: '1px solid #e5e7eb', borderLeft: `4px solid ${status === 'resolvido' ? '#16a34a' : status === 'lido' ? '#f59e0b' : '#e63946'}`, borderRadius: 10, padding: 14, marginBottom: 12, background: '#fff' })
const badge = (status = 'novo') => ({ background: status === 'resolvido' ? '#dcfce7' : status === 'lido' ? '#fef3c7' : '#fee2e2', color: status === 'resolvido' ? '#166534' : status === 'lido' ? '#92400e' : '#991b1b', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' })
const btnMini = { background: '#f3f4f6', color: '#333', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
const btnMiniOk = { background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
const btnMiniDanger = { background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 7, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }
